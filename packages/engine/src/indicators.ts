/**
 * Indikator teknikal — fungsi murni, tanpa state eksternal.
 * Implementasi sendiri agar terkontrol & mudah di-unit-test (PRD 10.2).
 */

export interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/** Simple Moving Average. Mengembalikan array dengan null untuk periode awal. */
export function sma(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = new Array(values.length).fill(null);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += values[i] ?? 0;
        if (i >= period) sum -= values[i - period] ?? 0;
        if (i >= period - 1) out[i] = sum / period;
    }
    return out;
}

/** Exponential Moving Average. */
export function ema(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = new Array(values.length).fill(null);
    if (values.length === 0) return out;
    const k = 2 / (period + 1);
    let prev = values[0] ?? 0;
    out[0] = prev;
    for (let i = 1; i < values.length; i++) {
        prev = (values[i] ?? 0) * k + prev * (1 - k);
        out[i] = prev;
    }
    return out;
}

/** RSI (Wilder smoothing). */
export function rsi(values: number[], period = 14): (number | null)[] {
    const out: (number | null)[] = new Array(values.length).fill(null);
    if (values.length <= period) return out;

    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i++) {
        const diff = (values[i] ?? 0) - (values[i - 1] ?? 0);
        if (diff >= 0) gain += diff;
        else loss -= diff;
    }
    let avgGain = gain / period;
    let avgLoss = loss / period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < values.length; i++) {
        const diff = (values[i] ?? 0) - (values[i - 1] ?? 0);
        avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
}

export interface MACDResult {
    macd: (number | null)[];
    signal: (number | null)[];
    histogram: (number | null)[];
}

/** MACD (12, 26, 9). */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MACDResult {
    const emaFast = ema(values, fast);
    const emaSlow = ema(values, slow);
    const macdLine: (number | null)[] = values.map((_, i) => {
        const f = emaFast[i];
        const s = emaSlow[i];
        return f != null && s != null ? f - s : null;
    });

    // Signal = EMA dari macdLine (hanya nilai non-null)
    const valid = macdLine.filter((v): v is number => v != null);
    const signalEma = ema(valid, signalPeriod);
    const signal: (number | null)[] = new Array(values.length).fill(null);
    let vi = 0;
    for (let i = 0; i < values.length; i++) {
        if (macdLine[i] != null) {
            signal[i] = signalEma[vi] ?? null;
            vi++;
        }
    }

    const histogram: (number | null)[] = values.map((_, i) => {
        const m = macdLine[i];
        const s = signal[i];
        return m != null && s != null ? m - s : null;
    });

    return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
}

/** Bollinger Bands (20, 2). */
export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
    const middle = sma(values, period);
    const upper: (number | null)[] = new Array(values.length).fill(null);
    const lower: (number | null)[] = new Array(values.length).fill(null);

    for (let i = period - 1; i < values.length; i++) {
        const slice = values.slice(i - period + 1, i + 1);
        const mean = middle[i] ?? 0;
        const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
        const sd = Math.sqrt(variance);
        upper[i] = mean + mult * sd;
        lower[i] = mean - mult * sd;
    }
    return { upper, middle, lower };
}

/** Average True Range (Wilder). */
export function atr(candles: Candle[], period = 14): (number | null)[] {
    const out: (number | null)[] = new Array(candles.length).fill(null);
    if (candles.length <= period) return out;

    const trs: number[] = [];
    for (let i = 0; i < candles.length; i++) {
        const c = candles[i]!;
        if (i === 0) {
            trs.push(c.high - c.low);
            continue;
        }
        const prevClose = candles[i - 1]!.close;
        trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
    }

    let prevAtr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    out[period - 1] = prevAtr;
    for (let i = period; i < trs.length; i++) {
        prevAtr = (prevAtr * (period - 1) + trs[i]!) / period;
        out[i] = prevAtr;
    }
    return out;
}

/** Volume SMA. */
export function volumeSma(candles: Candle[], period = 20): (number | null)[] {
    return sma(candles.map((c) => c.volume), period);
}

/** Stochastic Oscillator (%K, %D). */
export interface StochasticResult {
    k: (number | null)[];
    d: (number | null)[];
}

export function stochastic(
    candles: Candle[],
    period = 14,
    smoothK = 3,
    smoothD = 3,
): StochasticResult {
    const rawK: (number | null)[] = new Array(candles.length).fill(null);
    for (let i = period - 1; i < candles.length; i++) {
        const slice = candles.slice(i - period + 1, i + 1);
        const highestHigh = Math.max(...slice.map((c) => c.high));
        const lowestLow = Math.min(...slice.map((c) => c.low));
        const currentClose = candles[i]!.close;
        const range = highestHigh - lowestLow;
        rawK[i] = range === 0 ? 50 : ((currentClose - lowestLow) / range) * 100;
    }

    // Smooth rawK to get %K
    const k: (number | null)[] = new Array(candles.length).fill(null);
    for (let i = period - 1 + smoothK - 1; i < candles.length; i++) {
        const slice = rawK.slice(i - smoothK + 1, i + 1);
        if (slice.every((val) => val != null)) {
            k[i] = slice.reduce((a, b) => a! + b!, 0)! / smoothK;
        }
    }

    // Smooth %K to get %D
    const d: (number | null)[] = new Array(candles.length).fill(null);
    for (let i = period - 1 + smoothK - 1 + smoothD - 1; i < candles.length; i++) {
        const slice = k.slice(i - smoothD + 1, i + 1);
        if (slice.every((val) => val != null)) {
            d[i] = slice.reduce((a, b) => a! + b!, 0)! / smoothD;
        }
    }

    return { k, d };
}

/** Ambil nilai terakhir yang bukan null. */
export function lastNonNull<T>(arr: (T | null)[]): T | null {
    for (let i = arr.length - 1; i >= 0; i--) {
        const v = arr[i];
        if (v != null) return v;
    }
    return null;
}