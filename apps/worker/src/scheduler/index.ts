/**
 * Scheduler — job terjadwal (node-cron).
 * - EOD pipeline: 16:00 WIB (setelah bursa tutup 15:30)
 * - Quote refresh: tiap 5 menit saat jam bursa
 * - Outbox notifikasi: tiap 30 detik
 * - Healthcheck: tiap 5 menit
 */

import cron from "node-cron";
import { prisma } from "@stock-analyst/db";
import { DEFAULT_WATCHLIST_TICKERS } from "@stock-analyst/shared";
import { syncHistoryToDb } from "../services/marketData";
import { evaluateStrategyForStock } from "../services/signalEngine";
import { processOutbox } from "../bot/notifier";
import { env } from "../config";
import { logger } from "../logger";

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

/** Pipeline EOD: fetch harga → simpan → evaluasi sinyal → notifikasi. */
async function runEodPipeline() {
    logger.info("mulai EOD pipeline");
    const stocks = await getActiveStocks();
    const strategies = await prisma.strategy.findMany({
        where: { isActive: true, mode: { in: ["SIGNAL_ONLY", "PAPER"] } },
    });

    for (const stock of stocks) {
        try {
            await syncHistoryToDb(prisma, stock.id, stock.yahooSymbol, 260);

            const bars = await prisma.priceBar.findMany({
                where: { stockId: stock.id },
                orderBy: { timestamp: "asc" },
                take: 260,
            });

            if (bars.length < 30) continue;

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
            logger.error({ err, ticker: stock.ticker }, "error di EOD pipeline");
        }
    }

    await processOutbox(prisma);
    logger.info("EOD pipeline selesai");
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
    // EOD: 16:00 WIB setiap hari kerja
    cron.schedule("0 16 * * 1-5", runEodPipeline, { timezone: env.BOT_TIMEZONE });

    // Quote refresh: tiap 5 menit saat jam bursa (09:00–15:30 WIB, Senin–Jumat)
    cron.schedule("*/5 9-15 * * 1-5", runQuoteRefresh, { timezone: env.BOT_TIMEZONE });

    // Outbox: proses notifikasi tertunda tiap 30 detik
    cron.schedule("*/30 * * * * *", () => processOutbox(prisma), { timezone: env.BOT_TIMEZONE });

    // Healthcheck log tiap 5 menit
    cron.schedule("*/5 * * * *", () => {
        logger.info("healthcheck OK");
    });

    logger.info("scheduler dimulai (EOD 16:00 WIB, quote refresh 5 menit)");
}