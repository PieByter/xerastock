/**
 * Scheduler — job terjadwal (node-cron).
 * - Sesi Pagi (BPJS / Day Trade): tiap 15 menit 09:00–10:30 WIB (PRD §10.1)
 * - Sesi Sore (BSJP): tiap 15 menit 14:30–15:50 WIB (PRD §10.1)
 * - EOD pipeline & Swing: 16:00 WIB (setelah bursa tutup 15:30)
 * - Broker summary sync: 16:30 WIB (setelah harga EOD tersimpan)
 * - Corporate action sync: 17:00 WIB (mengisi tabel yang dipakai reminder)
 * - Corporate Action alerts: 08:30 WIB (H-3 dan H-1 sebelum cum-date)
 * - Quote refresh: tiap 5 menit saat jam bursa (harga live dari provider)
 * - Berita RSS + ringkasan AI: tiap 30 menit (06:00–21:00 WIB)
 * - Outbox notifikasi: tiap 30 detik
 *
 * Semua job yang bergantung pada pasar dilewati saat bukan hari bursa
 * (kalender di tabel `CalendarDay` + env MARKET_HOLIDAYS).
 */

import cron from "node-cron";
import { prisma } from "@stock-analyst/db";
import { DEFAULT_WATCHLIST_TICKERS, type StrategyType } from "@stock-analyst/shared";
import { marketData, saveLiveQuoteToDb, syncHistoryToDb } from "../services/marketData";
import { runBrokerSyncPipeline } from "../services/brokerData";
import { syncNewsToDb } from "../services/newsData";
import { runCorporateActionSyncPipeline } from "../services/corporateActionData";
import { isTradingDay } from "../services/marketCalendar";
import { evaluateStrategyForStock } from "../services/signalEngine";
import { PaperBroker } from "../services/paperBroker";
import { monitorPositionExits } from "../services/tradeEngine";
import { DiscordNotifier, processOutbox } from "../bot/notifier";
import { env } from "../config";
import { logger } from "../logger";

const notifier = new DiscordNotifier();
const broker = new PaperBroker(prisma);

/** true bila hari ini hari bursa; job pasar dilewati saat libur (FR-DATA-005). */
async function marketOpenToday(): Promise<boolean> {
    const trading = await isTradingDay(prisma);
    if (!trading) logger.info("hari ini bukan hari bursa — job dilewati");
    return trading;
}

/** Ambil semua saham aktif dari DB (fallback ke default list). */
async function getActiveStocks() {
    const stocks = await prisma.stock.findMany({ where: { isActive: true } });
    if (stocks.length > 0) return stocks;

    // Jangan seed ulang kalau user sengaja menonaktifkan semua saham.
    const total = await prisma.stock.count();
    if (total > 0) return [];

    // Seed awal hanya saat database benar-benar kosong.
    const created = [];
    for (const ticker of DEFAULT_WATCHLIST_TICKERS) {
        created.push(
            await prisma.stock.upsert({
                where: { ticker },
                create: { ticker, name: ticker, exchange: "IDX", yahooSymbol: ticker },
                update: {},
            }),
        );
    }
    return created;
}

/** Pipeline evaluasi strategi berdasarkan session type (PRD §10.1). */
async function runSessionEvaluation(sessionType: StrategyType) {
    if (!(await marketOpenToday())) return;
    logger.info({ sessionType }, `Mulai evaluasi sesi sinyal ${sessionType}`);
    const stocks = await getActiveStocks();
    const strategies = await prisma.strategy.findMany({
        where: {
            isActive: true,
            strategyType: sessionType,
            mode: { in: ["SIGNAL_ONLY", "PAPER"] },
        },
    });

    for (const stock of stocks) {
        try {
            // Ambil 120 bar TERBARU (desc) lalu balik ke urutan ascending —
            // kalau pakai asc + take, yang terambil justru 120 bar terlama.
            const recentBars = await prisma.priceBar.findMany({
                where: { stockId: stock.id },
                orderBy: { timestamp: "desc" },
                take: 120,
            });

            if (recentBars.length < 20) continue;

            const candles = [...recentBars].reverse().map((b) => ({
                open: Number(b.open),
                high: Number(b.high),
                low: Number(b.low),
                close: Number(b.close),
                volume: Number(b.volume),
            }));

            for (const strategy of strategies) {
                if (!strategy.stockIds.includes(stock.ticker)) continue;
                await evaluateStrategyForStock({
                    prisma,
                    strategyId: strategy.id,
                    stockId: stock.id,
                    ticker: stock.ticker,
                    candles,
                    broker,
                });
            }
        } catch (err) {
            logger.error({ err, ticker: stock.ticker, sessionType }, "Error saat evaluasi sesi sinyal");
        }
    }

    await processOutbox(prisma);
}

/** Pipeline EOD: fetch harga → simpan → evaluasi sinyal Swing → notifikasi. */
async function runEodPipeline() {
    if (!(await marketOpenToday())) return;
    logger.info("Mulai EOD pipeline & Swing evaluation");
    const stocks = await getActiveStocks();

    for (const stock of stocks) {
        try {
            await syncHistoryToDb(prisma, stock.id, stock.yahooSymbol, 260);
        } catch (err) {
            logger.error({ err, ticker: stock.ticker }, "Error sync history di EOD pipeline");
        }
    }

    await runSessionEvaluation("SWING");

    // Stop loss / take profit memakai harga EOD yang baru saja disinkronkan.
    const closed = await monitorPositionExits(prisma, broker);
    if (closed > 0) logger.info({ closed }, "posisi ditutup otomatis di EOD");
    await processOutbox(prisma);

    logger.info("EOD pipeline & Swing selesai");
}

/** Cek kalender dividen & corporate action untuk notifikasi H-3 dan H-1 (PRD §4.4). */
async function runCorporateActionAlerts() {
    if (!(await marketOpenToday())) return;
    logger.info("Memeriksa kalender corporate action (H-3 dan H-1)...");
    const now = new Date();
    const upcoming = await prisma.corporateAction.findMany({
        where: {
            cumDate: {
                gte: now,
                lte: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 hari ke depan
            },
        },
    });

    for (const ca of upcoming) {
        const diffDays = Math.ceil((ca.cumDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1 || diffDays === 3) {
            await prisma.alertEvent.create({
                data: {
                    type: "DIVIDEND_ALERT",
                    sentTo: "discord",
                    status: "QUEUED",
                    payloadJson: {
                        type: "PRICE_ALERT",
                        title: `📅 Reminder Corporate Action: ${ca.ticker}`,
                        description: `${ca.title} — Cum Date tinggal H-${diffDays} (${ca.cumDate.toLocaleDateString("id-ID")})`,
                        fields: [
                            { name: "Ticker", value: ca.ticker, inline: true },
                            { name: "Jenis", value: ca.type, inline: true },
                            { name: "Detail", value: ca.detail ?? "—", inline: true },
                        ],
                    },
                },
            });
        }
    }
    await processOutbox(prisma);
}

/** Refresh quote (harga baru dari provider) & evaluasi alert harga saat jam bursa. */
async function runQuoteRefresh() {
    if (!(await marketOpenToday())) return;
    const stocks = await getActiveStocks();
    let updated = 0;

    for (const stock of stocks) {
        try {
            // Ambil harga terkini dari provider, lalu simpan sebagai bar hari ini
            // supaya alert & stop loss memakai harga berjalan, bukan harga EOD.
            const quote = await marketData.getQuote(stock.yahooSymbol);
            const price = await saveLiveQuoteToDb(prisma, stock.id, quote);
            if (price == null) continue;
            updated++;

            const alerts = await prisma.alert.findMany({
                where: { stockId: stock.id, status: "ACTIVE" },
            });
            for (const alert of alerts) {
                const cond = alert.conditionJson as { level?: number };
                const level = cond.level ?? 0;
                const triggered =
                    alert.type === "PRICE_ABOVE" ? price >= level : alert.type === "PRICE_BELOW" ? price <= level : false;
                if (triggered) {
                    await prisma.alertEvent.create({
                        data: {
                            alertId: alert.id,
                            type: "PRICE_ALERT",
                            sentTo: "discord",
                            status: "QUEUED",
                            payloadJson: {
                                type: "PRICE_ALERT",
                                title: `🔔 Alert ${stock.ticker}`,
                                description: `Harga ${price.toLocaleString("id-ID")} ${alert.type === "PRICE_ABOVE" ? "≥" : "≤"} ${level.toLocaleString("id-ID")}`,
                            },
                        },
                    });
                    if (!alert.repeat) {
                        await prisma.alert.update({
                            where: { id: alert.id },
                            data: { status: "TRIGGERED", lastTriggeredAt: new Date() },
                        });
                    }
                }
            }
        } catch (err) {
            logger.error({ err, ticker: stock.ticker }, "error di quote refresh");
        }
    }

    logger.info({ updated, total: stocks.length }, "quote refresh selesai");

    // Pantau stop loss / take profit tiap siklus refresh (jam bursa).
    try {
        const closed = await monitorPositionExits(prisma, broker);
        if (closed > 0) logger.info({ closed }, "posisi ditutup otomatis oleh SL/TP");
    } catch (err) {
        logger.error({ err }, "error saat memantau exit posisi");
    }

    await processOutbox(prisma);
}

/** Sinkronisasi broker summary & foreign flow untuk semua saham aktif. */
async function runBrokerSync() {
    if (!(await marketOpenToday())) return;
    const stocks = await getActiveStocks();
    await runBrokerSyncPipeline(prisma, stocks);
}

/** Sinkronisasi corporate action (PRD §4.4) — mengisi tabel yang dibaca job reminder. */
async function runCorporateActionSync() {
    if (!(await marketOpenToday())) return;
    const stocks = await getActiveStocks();
    await runCorporateActionSyncPipeline(prisma, stocks);
}

/** Sinkronisasi berita RSS + ringkasan/sentimen AI (PRD §4.5). */
async function runNewsSync() {
    try {
        await syncNewsToDb(prisma);
    } catch (err) {
        logger.error({ err }, "error saat sinkronisasi berita");
    }
    await processOutbox(prisma);
}

export function startScheduler() {
    // 1. Sesi Pagi (BPJS / Day Trade): tiap 15 menit antara 09:00–10:30 WIB
    cron.schedule("*/15 9,10 * * 1-5", () => runSessionEvaluation("BPJS"), { timezone: env.BOT_TIMEZONE });

    // 2. Sesi Sore (BSJP): tiap 15 menit antara 14:30–15:50 WIB
    cron.schedule("30,45 14 * * 1-5", () => runSessionEvaluation("BSJP"), { timezone: env.BOT_TIMEZONE });
    cron.schedule("0,15,30,45 15 * * 1-5", () => runSessionEvaluation("BSJP"), { timezone: env.BOT_TIMEZONE });

    // 3. EOD Pipeline & Swing evaluation: 16:00 WIB setiap hari kerja
    cron.schedule("0 16 * * 1-5", runEodPipeline, { timezone: env.BOT_TIMEZONE });

    // 4. Broker summary & foreign flow: 16:30 WIB (setelah harga EOD tersimpan)
    cron.schedule("30 16 * * 1-5", runBrokerSync, { timezone: env.BOT_TIMEZONE });

    // 5. Corporate Action / Dividen reminders (H-3 dan H-1): jam 08:30 WIB
    cron.schedule("30 8 * * 1-5", runCorporateActionAlerts, { timezone: env.BOT_TIMEZONE });

    // 5b. Sinkronisasi corporate action: 17:00 WIB (setelah broker sync)
    cron.schedule("0 17 * * 1-5", runCorporateActionSync, { timezone: env.BOT_TIMEZONE });

    // 6. Quote refresh: tiap 5 menit saat jam bursa (09:00–15:30 WIB, Senin–Jumat)
    cron.schedule("*/5 9-15 * * 1-5", runQuoteRefresh, { timezone: env.BOT_TIMEZONE });

    // 7. Outbox: proses notifikasi tertunda tiap 30 detik
    cron.schedule("*/30 * * * * *", () => processOutbox(prisma), { timezone: env.BOT_TIMEZONE });

    // 8. Berita RSS + ringkasan AI: tiap 30 menit (06:00–21:00 WIB, hari kerja)
    cron.schedule("*/30 6-21 * * 1-5", runNewsSync, { timezone: env.BOT_TIMEZONE });

    // 9. Healthcheck log tiap 5 menit
    cron.schedule("*/5 * * * *", () => {
        logger.info("scheduler healthcheck OK");
    });

    logger.info(
        "scheduler aktif (BPJS 09:00–10:30 WIB, BSJP 14:30–15:50 WIB, Swing 16:00 WIB, broker sync 16:30 WIB, corporate action 17:00 WIB, berita tiap 30 menit)",
    );
}