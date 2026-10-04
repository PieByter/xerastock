/**
 * Aturan sinyal (rule-based) — PRD Modul B & D.
 * Setiap rule adalah fungsi murni: (candles, params) => boolean.
 * Anti-look-ahead: hanya memakai data sampai bar terakhir yang tersedia.
 */

import type { Candle } from "./indicators";
import { sma, ema, rsi, macd, bollinger, lastNonNull } from "./indicators";
import type { RuleConfig, RuleType, SignalDirection } from "@stock-analyst/shared";

export interface RuleContext {
    candles: Candle[];
    /** Data fundamental opsional (untuk rule FUNDAMENTAL_*). */
    fundamentals?: {
        pbv?: number;
        per?: number;
    };
    /** Data foreign flow & broker summary (PRD §4.3 & §10.1). */
    foreignFlow?: {
        todayNetForeign?: number;
        multiDayNetForeign?: number;
    };
    /** Data sentimen berita (PRD §4.5). */
    sentiment?: {
        hasNegativeNews?: boolean;
        positiveCount?: number;
    };
}

export interface RuleResult {
    matched: boolean;
    reason: string;
}

type RuleFn = (ctx: RuleContext, params: Record<string, number | string | boolean>) => RuleResult;

const closes = (c: Candle[]) => c.map((x) => x.close);

/** Golden cross: MA cepat memotong MA lambat ke atas. */
const maCrossUp: RuleFn = (ctx, params) => {
    const fast = Number(params.fastPeriod ?? 20);
    const slow = Number(params.slowPeriod ?? 50);
    const c = closes(ctx.candles);
    const f = sma(c, fast);
    const s = sma(c, slow);
    const i = c.length - 1;
    const prevF = f[i - 1];
    const prevS = s[i - 1];
    const curF = f[i];
    const curS = s[i];
    if (prevF == null || prevS == null || curF == null || curS == null) {
        return { matched: false, reason: "data MA tidak cukup" };
    }
    const matched = prevF <= prevS && curF > curS;
    return { matched, reason: `MA${fast} golden cross MA${slow}` };
};

/** Death cross: MA cepat memotong MA lambat ke bawah. */
const maCrossDown: RuleFn = (ctx, params) => {
    const fast = Number(params.fastPeriod ?? 20);
    const slow = Number(params.slowPeriod ?? 50);
    const c = closes(ctx.candles);
    const f = sma(c, fast);
    const s = sma(c, slow);
    const i = c.length - 1;
    const prevF = f[i - 1];
    const prevS = s[i - 1];
    const curF = f[i];
    const curS = s[i];
    if (prevF == null || prevS == null || curF == null || curS == null) {
        return { matched: false, reason: "data MA tidak cukup" };
    }
    const matched = prevF >= prevS && curF < curS;
    return { matched, reason: `MA${fast} death cross MA${slow}` };
};

/** RSI oversold (masuk dari bawah threshold). */
const rsiOversold: RuleFn = (ctx, params) => {
    const period = Number(params.period ?? 14);
    const threshold = Number(params.threshold ?? 30);
    const r = rsi(closes(ctx.candles), period);
    const i = r.length - 1;
    const cur = r[i];
    const prev = r[i - 1];
    if (cur == null || prev == null) return { matched: false, reason: "data RSI tidak cukup" };
    const matched = prev <= threshold && cur > threshold;
    return { matched, reason: `RSI${period} rebound dari oversold (${cur.toFixed(1)})` };
};

/** RSI overbought (turun dari atas threshold). */
const rsiOverbought: RuleFn = (ctx, params) => {
    const period = Number(params.period ?? 14);
    const threshold = Number(params.threshold ?? 70);
    const r = rsi(closes(ctx.candles), period);
    const i = r.length - 1;
    const cur = r[i];
    const prev = r[i - 1];
    if (cur == null || prev == null) return { matched: false, reason: "data RSI tidak cukup" };
    const matched = prev >= threshold && cur < threshold;
    return { matched, reason: `RSI${period} turun dari overbought (${cur.toFixed(1)})` };
};

/** MACD golden cross (histogram berubah positif). */
const macdCrossUp: RuleFn = (ctx, params) => {
    const { histogram } = macd(closes(ctx.candles));
    const i = histogram.length - 1;
    const cur = histogram[i];
    const prev = histogram[i - 1];
    if (cur == null || prev == null) return { matched: false, reason: "data MACD tidak cukup" };
    const matched = prev <= 0 && cur > 0;
    return { matched, reason: "MACD golden cross" };
};

/** MACD death cross. */
const macdCrossDown: RuleFn = (ctx, params) => {
    const { histogram } = macd(closes(ctx.candles));
    const i = histogram.length - 1;
    const cur = histogram[i];
    const prev = histogram[i - 1];
    if (cur == null || prev == null) return { matched: false, reason: "data MACD tidak cukup" };
    const matched = prev >= 0 && cur < 0;
    return { matched, reason: "MACD death cross" };
};

/** Harga menembus Bollinger upper (breakout). */
const bollingerBreakUp: RuleFn = (ctx, params) => {
    const period = Number(params.period ?? 20);
    const { upper } = bollinger(closes(ctx.candles), period);
    const i = ctx.candles.length - 1;
    const band = upper[i];
    if (band == null) return { matched: false, reason: "data Bollinger tidak cukup" };
    const price = ctx.candles[i]!.close;
    const matched = price > band;
    return { matched, reason: `Breakout di atas Bollinger upper (${band.toFixed(2)})` };
};

/** Harga di atas MA (uptrend). */
const priceAboveMa: RuleFn = (ctx, params) => {
    const period = Number(params.period ?? 50);
    const c = closes(ctx.candles);
    const m = sma(c, period);
    const i = c.length - 1;
    const ma = m[i];
    if (ma == null) return { matched: false, reason: "data MA tidak cukup" };
    const matched = c[i]! > ma;
    return { matched, reason: `Harga di atas MA${period}` };
};

/** Harga di bawah MA (downtrend). */
const priceBelowMa: RuleFn = (ctx, params) => {
    const period = Number(params.period ?? 50);
    const c = closes(ctx.candles);
    const m = sma(c, period);
    const i = c.length - 1;
    const ma = m[i];
    if (ma == null) return { matched: false, reason: "data MA tidak cukup" };
    const matched = c[i]! < ma;
    return { matched, reason: `Harga di bawah MA${period}` };
};

/** Fundamental: PBV rendah (value trap filter). */
const fundamentalPbvLow: RuleFn = (ctx, params) => {
    const maxPbv = Number(params.maxPbv ?? 1.5);
    const pbv = ctx.fundamentals?.pbv;
    if (pbv == null) return { matched: false, reason: "data PBV tidak tersedia" };
    const matched = pbv <= maxPbv;
    return { matched, reason: `PBV ${pbv.toFixed(2)} ≤ ${maxPbv}` };
};

/** Fundamental: PER rendah. */
const fundamentalPerLow: RuleFn = (ctx, params) => {
    const maxPer = Number(params.maxPer ?? 15);
    const per = ctx.fundamentals?.per;
    if (per == null) return { matched: false, reason: "data PER tidak tersedia" };
    const matched = per <= maxPer;
    return { matched, reason: `PER ${per.toFixed(2)} ≤ ${maxPer}` };
};

/** AI score (dari sidecar ML, Fase 2). */
const aiScore: RuleFn = (ctx, params) => {
    const threshold = Number(params.threshold ?? 0.6);
    const score = Number(params.score ?? 0);
    const matched = score >= threshold;
    return { matched, reason: `AI score ${score.toFixed(2)} ≥ ${threshold}` };
};

const RULES: Record<RuleType, RuleFn> = {
    MA_CROSS: maCrossUp,
    RSI_OVERSOLD: rsiOversold,
    RSI_OVERBOUGHT: rsiOverbought,
    MACD_CROSS: macdCrossUp,
    BOLLINGER_BREAK: bollingerBreakUp,
    PRICE_ABOVE_MA: priceAboveMa,
    PRICE_BELOW_MA: priceBelowMa,
    FUNDAMENTAL_PBV_LOW: fundamentalPbvLow,
    FUNDAMENTAL_PER_LOW: fundamentalPerLow,
    AI_SCORE: aiScore,
};

/** Arah default per rule (untuk entry). */
export const RULE_DIRECTION: Record<RuleType, SignalDirection> = {
    MA_CROSS: "BUY",
    RSI_OVERSOLD: "BUY",
    RSI_OVERBOUGHT: "SELL",
    MACD_CROSS: "BUY",
    BOLLINGER_BREAK: "BUY",
    PRICE_ABOVE_MA: "BUY",
    PRICE_BELOW_MA: "SELL",
    FUNDAMENTAL_PBV_LOW: "BUY",
    FUNDAMENTAL_PER_LOW: "BUY",
    AI_SCORE: "BUY",
};

/** Evaluasi satu rule. */
export function evaluateRule(rule: RuleConfig, ctx: RuleContext): RuleResult {
    const fn = RULES[rule.type];
    if (!fn) return { matched: false, reason: `rule tidak dikenal: ${rule.type}` };
    return fn(ctx, rule.params);
}

export interface SignalEvaluation {
    direction: SignalDirection;
    reasons: string[];
    strength: number;
}

/**
 * Evaluasi kumpulan rule entry/exit.
 * Sinyal BUY jika ≥ minMatch rule entry cocok; SELL jika rule exit cocok.
 */
export function evaluateRules(
    entryRules: RuleConfig[],
    exitRules: RuleConfig[],
    ctx: RuleContext,
    minMatch = 1,
): SignalEvaluation | null {
    const entryHits = entryRules
        .map((r) => evaluateRule(r, ctx))
        .filter((r) => r.matched);

    const exitHits = exitRules
        .map((r) => evaluateRule(r, ctx))
        .filter((r) => r.matched);

    if (exitHits.length >= minMatch) {
        return {
            direction: "SELL",
            reasons: exitHits.map((r) => r.reason),
            strength: Math.min(1, exitHits.length / Math.max(exitRules.length, 1)),
        };
    }

    if (entryHits.length >= minMatch) {
        return {
            direction: "BUY",
            reasons: entryHits.map((r) => r.reason),
            strength: Math.min(1, entryHits.length / Math.max(entryRules.length, 1)),
        };
    }

    return null;
}

// ---------- Strategi Khusus IDX (PRD §10.1) ----------

export interface StrategyEvaluationResult {
    matched: boolean;
    strategyType: "BSJP" | "BPJS" | "SWING";
    direction: SignalDirection;
    reasons: string[];
    strength: number;
    price: number;
}

/** Helper ambil nilai RSI terakhir */
function lastRsiValue(arr: (number | null)[]): number | null {
    return lastNonNull(arr);
}

/**
 * BSJP (Beli Sore, Jual Pagi) — Dievaluasi di sesi sore (~14:30–15:50 WIB)
 * Syarat:
 * 1. Volume spike (volume bar terakhir > 1.4x rata-rata 20 hari)
 * 2. Foreign net buy hari ini positif (> 0)
 * 3. Candle bullish closing di dekat level tertinggi (close >= low + 0.70 * (high - low))
 */
export function evaluateBsjp(ctx: RuleContext): StrategyEvaluationResult | null {
    if (ctx.candles.length < 20) return null;
    const last = ctx.candles[ctx.candles.length - 1]!;
    const volumes = ctx.candles.map((c) => c.volume);
    const volSma = sma(volumes, 20);
    const avgVol = volSma[volSma.length - 1] ?? 0;

    const reasons: string[] = [];
    let score = 0;

    // 1. Volume spike
    if (avgVol > 0 && last.volume >= avgVol * 1.4) {
        reasons.push(`Volume spike ${(last.volume / avgVol).toFixed(1)}x rata-rata 20 hari`);
        score += 0.35;
    }

    // 2. Foreign net buy
    if ((ctx.foreignFlow?.todayNetForeign ?? 0) > 0) {
        reasons.push("Net foreign buy hari ini positif");
        score += 0.35;
    }

    // 3. Candle bullish closing dekat high
    const dayRange = last.high - last.low;
    const isBullishClose = dayRange > 0 && last.close >= last.open && (last.close - last.low) >= (0.7 * dayRange);
    if (isBullishClose) {
        reasons.push("Candle bullish menutup di dekat level tertinggi hari ini");
        score += 0.3;
    }

    if (score >= 0.65) {
        return {
            matched: true,
            strategyType: "BSJP",
            direction: "BUY",
            reasons,
            strength: Math.min(1, score),
            price: last.close,
        };
    }
    return null;
}

/**
 * BPJS / Day Trade (Beli Pagi, Jual Sore) — Dievaluasi di sesi pagi (~09:00–10:30 WIB)
 * Syarat:
 * 1. Gap-up open (>0.8% di atas close kemarin) atau breakout
 * 2. RSI belum overbought (< 68)
 * 3. Volume aktif
 */
export function evaluateBpjs(ctx: RuleContext): StrategyEvaluationResult | null {
    if (ctx.candles.length < 15) return null;
    const last = ctx.candles[ctx.candles.length - 1]!;
    const prev = ctx.candles[ctx.candles.length - 2]!;
    const c = closes(ctx.candles);
    const rsiValues = rsi(c, 14);
    const lastRsi = lastRsiValue(rsiValues);

    const reasons: string[] = [];
    let score = 0;

    // 1. Gap up atau momentum kuat pagi
    const gapPct = ((last.open - prev.close) / prev.close) * 100;
    if (gapPct >= 0.8) {
        reasons.push(`Buka gap up +${gapPct.toFixed(1)}% di sesi pagi`);
        score += 0.4;
    } else if (last.close > prev.high) {
        reasons.push("Breakout di atas high hari sebelumnya");
        score += 0.35;
    }

    // 2. RSI belum overbought
    if (lastRsi != null && lastRsi < 68 && lastRsi >= 45) {
        reasons.push(`RSI (${lastRsi.toFixed(1)}) memiliki ruang momentum beli`);
        score += 0.35;
    }

    // 3. Volume aktif
    if (last.volume > 0) {
        score += 0.25;
    }

    if (score >= 0.65) {
        return {
            matched: true,
            strategyType: "BPJS",
            direction: "BUY",
            reasons,
            strength: Math.min(1, score),
            price: last.close,
        };
    }
    return null;
}

/**
 * Swing / Hold — Dievaluasi End-of-Day (16:00 WIB)
 * Syarat:
 * 1. Trend indikator positif (EMA20 >= EMA50 atau MACD > 0)
 * 2. Akumulasi asing multi-hari (>0 akumulatif)
 * 3. Tidak ada sentimen berita negatif mayor
 */
export function evaluateSwing(ctx: RuleContext): StrategyEvaluationResult | null {
    if (ctx.candles.length < 26) return null;
    const last = ctx.candles[ctx.candles.length - 1]!;
    const c = closes(ctx.candles);
    const ema20 = ema(c, 20);
    const ema50 = ema(c, 50);
    const macdRes = macd(c);

    const reasons: string[] = [];
    let score = 0;

    const lastEma20 = lastNonNull(ema20);
    const lastEma50 = lastNonNull(ema50);
    if (lastEma20 != null && lastEma50 != null && lastEma20 >= lastEma50) {
        reasons.push("Trend bullish: EMA20 berada di atas EMA50");
        score += 0.35;
    }

    const lastHist = lastNonNull(macdRes.histogram);
    if (lastHist != null && lastHist > 0) {
        reasons.push("MACD histogram positif");
        score += 0.25;
    }

    // Akumulasi asing multi-hari
    if ((ctx.foreignFlow?.multiDayNetForeign ?? 0) > 0) {
        reasons.push("Tren akumulasi asing positif dalam multi-hari");
        score += 0.3;
    }

    // Filter sentimen berita
    if (ctx.sentiment?.hasNegativeNews) {
        return null;
    } else {
        score += 0.1;
    }

    if (score >= 0.65) {
        return {
            matched: true,
            strategyType: "SWING",
            direction: "BUY",
            reasons,
            strength: Math.min(1, score),
            price: last.close,
        };
    }
    return null;
}

/**
 * Deteksi akumulasi broker (PRD §4.3)
 * Menemukan broker yang net buy selama 3 hari berturut-turut atau lebih.
 */
export interface BrokerAccumulationAlert {
    brokerCode: string;
    consecutiveDays: number;
    totalNetValue: number;
    message: string;
}

export function detectBrokerAccumulation(
    history: Array<{ date: string; brokerCode: string; netValue: number }>,
): BrokerAccumulationAlert[] {
    const alerts: BrokerAccumulationAlert[] = [];
    const brokerMap = new Map<string, Array<{ date: string; netValue: number }>>();
    for (const item of history) {
        if (!brokerMap.has(item.brokerCode)) {
            brokerMap.set(item.brokerCode, []);
        }
        brokerMap.get(item.brokerCode)!.push(item);
    }

    for (const [code, records] of brokerMap.entries()) {
        records.sort((a, b) => b.date.localeCompare(a.date));
        let count = 0;
        let totalVal = 0;
        for (const r of records) {
            if (r.netValue > 0) {
                count++;
                totalVal += r.netValue;
            } else {
                break;
            }
        }
        if (count >= 3) {
            alerts.push({
                brokerCode: code,
                consecutiveDays: count,
                totalNetValue: totalVal,
                message: `Broker ${code} net buy ${count} hari berturut-turut`,
            });
        }
    }
    return alerts;
}