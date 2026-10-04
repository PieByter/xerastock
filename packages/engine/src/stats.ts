/**
 * Statistik pendukung "analisis mendalam": rentang 52 minggu, volatilitas,
 * drawdown, rata-rata volume, dan level support/resistance dari swing point.
 *
 * Sama seperti indikator lain: fungsi murni, tanpa state.
 */

import type { Candle } from "./indicators";

const TRADING_DAYS_PER_YEAR = 252;

export interface KeyStats {
    lastClose: number;
    /** Tertinggi/terendah dalam min(252, jumlah candle) hari terakhir. */
    high52w: number;
    low52w: number;
    /** Posisi harga sekarang relatif ke low52w-high52w (0..1). */
    rangePosition: number;
    /** Jarak harga dari high52w dalam persen (<= 0). */
    pctFromHigh: number;
    change1w: number;
    change1m: number;
    change3m: number;
    change1y: number;
    avgVolume20: number;
    avgVolume60: number;
    /** Volume candle terakhir dibagi avgVolume20. */
    volumeRatio: number;
    /** Standar deviasi return harian, disetahunkan (persen). */
    volatility20: number;
    /** Drawdown terdalam dari puncak berjalan (persen, <= 0). */
    maxDrawdown: number;
    /** ATR14 dalam persen dari harga terakhir. */
    atrPct: number;
}

export interface PriceLevel {
    price: number;
    /** Berapa kali level ini disentuh swing point. */
    touches: number;
    /** Indeks candle sentuhan terakhir. */
    lastIndex: number;
}

export interface SupportResistance {
    supports: PriceLevel[];
    resistances: PriceLevel[];
}

export interface SupportResistanceOptions {
    /** Lebar jendela kiri/kanan untuk menganggap titik sebagai swing point. */
    lookback?: number;
    /** Toleransi pengelompokan level dalam persen harga. */
    tolerancePct?: number;
    /** Maksimum level yang dikembalikan per sisi. */
    maxLevels?: number;
}

function pctChange(from: number, to: number): number {
    if (!Number.isFinite(from) || from === 0) return 0;
    return ((to - from) / from) * 100;
}

function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = mean(values);
    return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

function closeNTradingDaysAgo(closes: number[], n: number): number | null {
    const index = closes.length - 1 - n;
    return index >= 0 ? closes[index] ?? null : null;
}

/**
 * Ringkasan statistik dari deret candle harian.
 * Mengembalikan `null` kalau candle kurang dari 2 (tidak ada return).
 */
export function keyStats(candles: Candle[]): KeyStats | null {
    if (candles.length < 2) return null;

    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);
    const lastClose = closes[closes.length - 1] ?? 0;

    const window52w = candles.slice(-TRADING_DAYS_PER_YEAR);
    const high52w = Math.max(...window52w.map((c) => c.high));
    const low52w = Math.min(...window52w.map((c) => c.low));

    const returnFor = (n: number): number => {
        const base = closeNTradingDaysAgo(closes, n);
        return base === null ? 0 : pctChange(base, lastClose);
    };

    const avgVolume20 = mean(volumes.slice(-20));
    const avgVolume60 = mean(volumes.slice(-60));
    const lastVolume = volumes[volumes.length - 1] ?? 0;

    const returns20 = closes.slice(-21).map((close, i, arr) => (i === 0 ? 0 : pctChange(arr[i - 1] ?? 0, close) / 100));
    const volatility20 = stdDev(returns20.slice(1)) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;

    let peak = candles[0]?.close ?? 0;
    let maxDrawdown = 0;
    for (const candle of candles) {
        if (candle.close > peak) peak = candle.close;
        const drawdown = peak > 0 ? ((candle.close - peak) / peak) * 100 : 0;
        if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }

    const atr14 = computeAtr(candles.slice(-15), 14);

    return {
        lastClose,
        high52w,
        low52w,
        rangePosition: high52w > low52w ? (lastClose - low52w) / (high52w - low52w) : 0.5,
        pctFromHigh: pctChange(high52w, lastClose),
        change1w: returnFor(5),
        change1m: returnFor(21),
        change3m: returnFor(63),
        change1y: returnFor(TRADING_DAYS_PER_YEAR),
        avgVolume20,
        avgVolume60,
        volumeRatio: avgVolume20 > 0 ? lastVolume / avgVolume20 : 0,
        volatility20,
        maxDrawdown,
        atrPct: lastClose > 0 ? (atr14 / lastClose) * 100 : 0,
    };
}

/** ATR sederhana (Wilder) untuk jendela terbatas. */
function computeAtr(candles: Candle[], period: number): number {
    if (candles.length < 2) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        const current = candles[i]!;
        const previous = candles[i - 1]!;
        trueRanges.push(
            Math.max(
                current.high - current.low,
                Math.abs(current.high - previous.close),
                Math.abs(current.low - previous.close),
            ),
        );
    }
    return mean(trueRanges.slice(-period));
}

/** Himpunan harga pada swing high & swing low. */
export function swingPoints(
    candles: Candle[],
    lookback = 5,
): { highs: { price: number; index: number }[]; lows: { price: number; index: number }[] } {
    const highs: { price: number; index: number }[] = [];
    const lows: { price: number; index: number }[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
        const candle = candles[i]!;
        let isHigh = true;
        let isLow = true;

        for (let j = i - lookback; j <= i + lookback; j++) {
            if (j === i) continue;
            const other = candles[j]!;
            if (candle.high < other.high) isHigh = false;
            if (candle.low > other.low) isLow = false;
        }

        if (isHigh) highs.push({ price: candle.high, index: i });
        if (isLow) lows.push({ price: candle.low, index: i });
    }

    return { highs, lows };
}

/** Gabungkan titik-titik harga yang berdekatan menjadi satu level. */
function clusterLevels(
    points: { price: number; index: number }[],
    tolerancePct: number,
): PriceLevel[] {
    if (points.length === 0) return [];

    const sorted = points.slice().sort((a, b) => a.price - b.price);
    const clusters: { prices: number[]; lastIndex: number }[] = [];

    for (const point of sorted) {
        const current = clusters[clusters.length - 1];
        const reference = current ? current.prices.reduce((sum, p) => sum + p, 0) / current.prices.length : null;

        if (current && reference !== null && Math.abs(point.price - reference) / reference <= tolerancePct) {
            current.prices.push(point.price);
            current.lastIndex = Math.max(current.lastIndex, point.index);
        } else {
            clusters.push({ prices: [point.price], lastIndex: point.index });
        }
    }

    return clusters.map((cluster) => ({
        price: cluster.prices.reduce((sum, p) => sum + p, 0) / cluster.prices.length,
        touches: cluster.prices.length,
        lastIndex: cluster.lastIndex,
    }));
}

/**
 * Level support/resistance dari swing point historis.
 * Support = level di bawah harga terakhir, resistance = di atasnya.
 * Urut dari yang paling dekat dengan harga terakhir.
 */
export function supportResistance(
    candles: Candle[],
    options: SupportResistanceOptions = {},
): SupportResistance {
    const { lookback = 5, tolerancePct = 0.015, maxLevels = 4 } = options;
    if (candles.length < lookback * 2 + 1) return { supports: [], resistances: [] };

    const lastClose = candles[candles.length - 1]!.close;
    const { highs, lows } = swingPoints(candles, lookback);

    const supports = clusterLevels(lows, tolerancePct)
        .filter((level) => level.price < lastClose)
        .sort((a, b) => b.price - a.price)
        .slice(0, maxLevels);

    const resistances = clusterLevels(highs, tolerancePct)
        .filter((level) => level.price > lastClose)
        .sort((a, b) => a.price - b.price)
        .slice(0, maxLevels);

    return { supports, resistances };
}
