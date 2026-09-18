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

export { sma, ema, rsi, macd, bollinger, lastNonNull };
export type { Candle } from "./indicators";