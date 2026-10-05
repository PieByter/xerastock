/**
 * Snapshot indikator harian (FR-TA-004) — fungsi murni yang menyusun nilai
 * indikator terakhir dari bar, dipakai worker untuk menyimpan snapshot per
 * ticker per hari (tanpa hitung ulang runtime di konsumen).
 */

import {
    atr,
    bollinger,
    macd,
    rsi,
    sma,
    stochastic,
    volumeSma,
    type Candle,
} from "./indicators";

export interface IndicatorSnapshotValues {
    close: number;
    sma20: number | null;
    sma50: number | null;
    rsi14: number | null;
    macdLine: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    bbUpper: number | null;
    bbMiddle: number | null;
    bbLower: number | null;
    atr14: number | null;
    volume: number;
    volumeAvg20: number | null;
    volumeRatio: number | null;
    stochasticK: number | null;
    stochasticD: number | null;
}

const MIN_CANDLES = 20;

/** Hitung snapshot dari bar terakhir; null bila bar belum cukup (min 20). */
export function buildIndicatorSnapshot(candles: Candle[]): IndicatorSnapshotValues | null {
    if (candles.length < MIN_CANDLES) return null;

    const closes = candles.map((c) => c.close);
    const i = closes.length - 1;
    const latest = <T>(arr: (T | null)[]): T | null => arr[i] ?? null;
    const round = (v: number | null, digits = 4): number | null =>
        v == null ? null : Number(v.toFixed(digits));

    const bands = bollinger(closes, 20);
    const macdResult = macd(closes);
    const stoch = stochastic(candles, 14, 3, 3);
    const volumeAverage = volumeSma(candles, 20)[i] ?? null;
    const volume = candles[i]!.volume;

    return {
        close: closes[i]!,
        sma20: round(latest(sma(closes, 20))),
        sma50: round(latest(sma(closes, 50))),
        rsi14: round(latest(rsi(closes, 14)), 2),
        macdLine: round(latest(macdResult.macd)),
        macdSignal: round(latest(macdResult.signal)),
        macdHistogram: round(latest(macdResult.histogram)),
        bbUpper: round(latest(bands.upper)),
        bbMiddle: round(latest(bands.middle)),
        bbLower: round(latest(bands.lower)),
        atr14: round(latest(atr(candles, 14))),
        volume,
        volumeAvg20: volumeAverage == null ? null : Math.round(volumeAverage),
        volumeRatio:
            volumeAverage != null && volumeAverage > 0
                ? Number((volume / volumeAverage).toFixed(2))
                : null,
        stochasticK: round(latest(stoch.k), 2),
        stochasticD: round(latest(stoch.d), 2),
    };
}
