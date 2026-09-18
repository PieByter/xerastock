/**
 * Signal Engine — evaluasi aturan strategi terhadap data harga,
 * persist sinyal ke DB, dan kirim event notifikasi (outbox).
 */

import type { PrismaClient } from "@stock-analyst/db";
import { evaluateRules, type Candle } from "@stock-analyst/engine";
import { SIGNAL_DEDUP_WINDOW_MS } from "@stock-analyst/shared";
import { logger } from "../logger";

interface EvaluateOptions {
    prisma: PrismaClient;
    strategyId: string;
    stockId: string;
    ticker: string;
    /** candles terurut ascending (terbaru di akhir). */
    candles: Candle[];
    fundamentals?: { pbv?: number; per?: number };
}

/**
 * Evaluasi satu strategi untuk satu saham.
 * Menghasilkan sinyal baru jika rule cocok & belum ada sinyal duplikat
 * dalam jendela dedup (anti notifikasi ganda).
 */
export async function evaluateStrategyForStock(opts: EvaluateOptions): Promise<boolean> {
    const { prisma, strategyId, stockId, ticker, candles, fundamentals } = opts;

    const strategy = await prisma.strategy.findUnique({ where: { id: strategyId } });
    if (!strategy || !strategy.isActive) return false;

    const entryRules = strategy.entryRulesJson as never as Parameters<typeof evaluateRules>[0];
    const exitRules = strategy.exitRulesJson as never as Parameters<typeof evaluateRules>[0];

    const result = evaluateRules(entryRules, exitRules, { candles, fundamentals });
    if (!result) return false;

    // Dedup: cek sinyal yang sama dalam 24 jam terakhir
    const since = new Date(Date.now() - SIGNAL_DEDUP_WINDOW_MS);
    const existing = await prisma.signal.findFirst({
        where: {
            stockId,
            strategyId,
            direction: result.direction,
            createdAt: { gte: since },
        },
    });
    if (existing) {
        logger.debug({ ticker, direction: result.direction }, "sinyal duplikat, dilewati");
        return false;
    }

    const lastBar = candles[candles.length - 1]!;
    const signal = await prisma.signal.create({
        data: {
            stockId,
            strategyId,
            source: "TECHNICAL",
            direction: result.direction,
            reasonJson: result.reasons,
            price: lastBar.close,
            strength: result.strength,
            status: "NEW",
        },
    });

    // Outbox notifikasi (reliability NFR-REL-06)
    await prisma.alertEvent.create({
        data: {
            signalId: signal.id,
            type: "SIGNAL",
            sentTo: "discord",
            status: "QUEUED",
            payloadJson: {
                ticker,
                direction: result.direction,
                reasons: result.reasons,
                price: lastBar.close,
                strength: result.strength,
            },
        },
    });

    logger.info(
        { ticker, direction: result.direction, reasons: result.reasons },
        "sinyal baru dibuat",
    );
    return true;
}