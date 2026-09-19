/**
 * Scheduler — job terjadwal (node-cron).
 * - Sesi Pagi (BPJS / Day Trade): tiap 15 menit 09:00–10:30 WIB (PRD §10.1)
 * - Sesi Sore (BSJP): tiap 15 menit 14:30–15:50 WIB (PRD §10.1)
 * - EOD pipeline & Swing: 16:00 WIB (setelah bursa tutup 15:30)
 * - Corporate Action alerts: 08:30 WIB (H-3 dan H-1 sebelum cum-date)
 * - Quote refresh: tiap 5 menit saat jam bursa
 * - Outbox notifikasi: tiap 30 detik
 */

import cron from "node-cron";
import { prisma } from "@stock-analyst/db";
import { DEFAULT_WATCHLIST_TICKERS, type StrategyType } from "@stock-analyst/shared";
import { syncHistoryToDb } from "../services/marketData";
import { evaluateStrategyForStock } from "../services/signalEngine";
import { DiscordNotifier, processOutbox } from "../bot/notifier";
import { env } from "../config";
import { logger } from "../logger";

const notifier = new DiscordNotifier();

/** Ambil semua saham aktif dari DB (fallback ke default list). */
async function getActiveStocks() {
    const stocks = await prisma.stock.findMany({ where: { isActive: true } });
    if (stocks.length > 0) return stocks;

    // Seed awal jika DB kosong
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
            const bars = await prisma.priceBar.findMany({
                where: { stockId: stock.id },
                orderBy: { timestamp: "asc" },
                take: 120,
            });

            if (bars.length < 20) continue;

            const candles = bars.map((b) => ({
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
    logger.info("EOD pipeline & Swing selesai");
}

/** Cek kalender dividen & corporate action untuk notifikasi H-3 dan H-1 (PRD §4.4). */
async function runCorporateActionAlerts() {
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

/** Refresh quote & evaluasi alert harga (saat jam bursa). */
async function runQuoteRefresh() {
    const stocks = await getActiveStocks();
    for (const stock of stocks) {
        try {
            const bars = await prisma.priceBar.findMany({
                where: { stockId: stock.id },
                orderBy: { timestamp: "desc" },
                take: 1,
            });
            if (bars.length === 0) continue;
            const last = bars[0]!;
            const alerts = await prisma.alert.findMany({
                where: { stockId: stock.id, status: "ACTIVE" },
            });
            for (const alert of alerts) {
                const cond = alert.conditionJson as { level?: number };
                const level = cond.level ?? 0;
                const price = Number(last.close);
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

    // 4. Corporate Action / Dividen reminders (H-3 dan H-1): jam 08:30 WIB
    cron.schedule("30 8 * * 1-5", runCorporateActionAlerts, { timezone: env.BOT_TIMEZONE });

    // 5. Quote refresh: tiap 5 menit saat jam bursa (09:00–15:30 WIB, Senin–Jumat)
    cron.schedule("*/5 9-15 * * 1-5", runQuoteRefresh, { timezone: env.BOT_TIMEZONE });

    // 6. Outbox: proses notifikasi tertunda tiap 30 detik
    cron.schedule("*/30 * * * * *", () => processOutbox(prisma), { timezone: env.BOT_TIMEZONE });

    // 7. Healthcheck log tiap 5 menit
    cron.schedule("*/5 * * * *", () => {
        logger.info("scheduler healthcheck OK");
    });

    logger.info("scheduler aktif (BPJS 09:00–10:30 WIB, BSJP 14:30–15:50 WIB, Swing 16:00 WIB)");
}