/**
 * Signal Engine — evaluasi aturan strategi terhadap data harga,
 * persist sinyal ke DB, dan kirim event notifikasi (outbox).
 */

import type { PrismaClient } from "@stock-analyst/db";
import { evaluateRules, type Candle } from "@stock-analyst/engine";
import { EMBED_COLORS, SIGNAL_DEDUP_WINDOW_MS, STRATEGY_CONFIG, type NotificationPayload, type StrategyType } from "@stock-analyst/shared";
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
    const strategyType = (strategy.strategyType ?? "SWING") as StrategyType;
    const signal = await prisma.signal.create({
        data: {
            stockId,
            strategyId,
            strategyType,
            source: "TECHNICAL",
            direction: result.direction,
            reasonJson: result.reasons,
            price: lastBar.close,
            strength: result.strength,
            status: "NEW",
        },
    });

    // Outbox notifikasi (reliability NFR-REL-06). Payload memakai kontrak
    // NotificationPayload supaya siap dikirim langsung oleh processOutbox.
    const strat = STRATEGY_CONFIG[strategyType];
    const payload: NotificationPayload = {
        type: "SIGNAL",
        title: `🚨 Sinyal ${strat ? strat.shortName : strategyType} — ${ticker}`,
        description: result.reasons.join(" · "),
        color: strat ? parseInt(strat.hexColor.replace("#", ""), 16) : EMBED_COLORS.info,
        fields: [
            { name: "Ticker", value: ticker, inline: true },
            { name: "Arah", value: result.direction, inline: true },
            { name: "Harga", value: `Rp ${lastBar.close.toLocaleString("id-ID")}`, inline: true },
            { name: "Kekuatan", value: `${Math.round(result.strength * 100)}%`, inline: true },
        ],
    };

    await prisma.alertEvent.create({
        data: {
            signalId: signal.id,
            type: "SIGNAL",
            sentTo: "discord",
            status: "QUEUED",
            payloadJson: JSON.parse(JSON.stringify(payload)),
        },
    });

    logger.info(
        { ticker, direction: result.direction, reasons: result.reasons },
        "sinyal baru dibuat",
    );
    return true;
}