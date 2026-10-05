/**
 * Signal Engine — evaluasi aturan strategi terhadap data harga,
 * persist sinyal ke DB, dan kirim event notifikasi (outbox).
 */

import type { PrismaClient } from "@stock-analyst/db";
import { evaluateRules, macd, rsi, sma, volumeSma, type Candle } from "@stock-analyst/engine";
import { EMBED_COLORS, SIGNAL_DEDUP_WINDOW_MS, STRATEGY_CONFIG, type NotificationPayload, type StrategyType } from "@stock-analyst/shared";
import type { BrokerAdapter } from "./paperBroker";
import { executeSignal } from "./tradeEngine";
import { logger } from "../logger";

/** Cuplikan indikator saat sinyal match — dipakai untuk evaluasi rule nanti. */
function indicatorSnapshot(candles: Candle[]) {
    const closes = candles.map((candle) => candle.close);
    const i = closes.length - 1;
    const rsi14 = rsi(closes, 14)[i];
    const ma20 = sma(closes, 20)[i];
    const ma50 = sma(closes, 50)[i];
    const histogram = macd(closes).histogram[i];
    const volumeAverage = volumeSma(candles, 20)[i];
    const volume = candles[i]?.volume ?? 0;
    const round = (value: number | null | undefined) =>
        value == null ? null : Number(value.toFixed(2));

    return {
        rsi14: round(rsi14),
        ma20: round(ma20),
        ma50: round(ma50),
        macdHistogram: round(histogram),
        volume,
        volumeRatio: volumeAverage && volumeAverage > 0 ? Number((volume / volumeAverage).toFixed(2)) : null,
    };
}

interface EvaluateOptions {
    prisma: PrismaClient;
    strategyId: string;
    stockId: string;
    ticker: string;
    /** candles terurut ascending (terbaru di akhir). */
    candles: Candle[];
    fundamentals?: { pbv?: number; per?: number };
    /** Bila diisi, sinyal langsung dieksekusi ke broker (paper trading). */
    broker?: BrokerAdapter;
}

/**
 * Evaluasi satu strategi untuk satu saham.
 * Menghasilkan sinyal baru jika rule cocok & belum ada sinyal duplikat
 * dalam jendela dedup (anti notifikasi ganda).
 */
export async function evaluateStrategyForStock(opts: EvaluateOptions): Promise<boolean> {
    const { prisma, strategyId, stockId, ticker, candles, fundamentals, broker } = opts;

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

    // Sambungkan ke eksekusi paper trading (guardrail ada di trade engine).
    let execution = "not-executed";
    if (broker) {
        try {
            execution = await executeSignal({
                prisma,
                broker,
                strategyId,
                stockId,
                ticker,
                signalId: signal.id,
                direction: result.direction,
                price: lastBar.close,
                reasons: result.reasons,
            });
            logger.info({ ticker, direction: result.direction, outcome: execution }, "hasil eksekusi sinyal");
        } catch (err) {
            execution = "error";
            logger.error({ err, ticker }, "gagal eksekusi sinyal");
        }
    }

    // SignalLog (PRD §4.6): arsip kondisi saat match + hasil eksekusinya,
    // bahan evaluasi "rule ini match berapa kali & hasilnya bagaimana".
    await prisma.signalLog.create({
        data: {
            signalId: signal.id,
            strategyType,
            ticker,
            notified: true,
            snapshotJson: JSON.parse(
                JSON.stringify({
                    direction: result.direction,
                    reasons: result.reasons,
                    strength: result.strength,
                    price: lastBar.close,
                    indicators: indicatorSnapshot(candles),
                    execution,
                }),
            ),
        },
    });

    return true;
}