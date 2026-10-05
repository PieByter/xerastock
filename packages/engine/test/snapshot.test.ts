import { describe, expect, it } from "vitest";
import type { Candle } from "../src/indicators";
import { buildIndicatorSnapshot } from "../src/snapshot";

function candles(length: number): Candle[] {
    return Array.from({ length }, (_, i) => ({
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 1000 + i * 10,
    }));
}

describe("buildIndicatorSnapshot", () => {
    it("mengembalikan null bila bar belum cukup", () => {
        expect(buildIndicatorSnapshot(candles(19))).toBeNull();
        expect(buildIndicatorSnapshot([])).toBeNull();
    });

    it("menghitung nilai indikator terakhir dengan benar", () => {
        const bars = candles(60);
        const snapshot = buildIndicatorSnapshot(bars);
        expect(snapshot).not.toBeNull();
        if (!snapshot) return;

        // close = bar terakhir; volume = bar terakhir.
        expect(snapshot.close).toBe(160);
        expect(snapshot.volume).toBe(1590);

        // SMA20 = rata-rata 20 close terakhir.
        const last20 = bars.slice(-20).map((c) => c.close);
        const expectedSma20 = last20.reduce((a, b) => a + b, 0) / 20;
        expect(snapshot.sma20).toBeCloseTo(expectedSma20, 3);

        // Band Bollinger terurut & volume ratio = volume / rata-rata 20.
        expect(snapshot.bbUpper!).toBeGreaterThanOrEqual(snapshot.bbMiddle!);
        expect(snapshot.bbMiddle!).toBeGreaterThanOrEqual(snapshot.bbLower!);
        expect(snapshot.volumeRatio).toBeCloseTo(1590 / snapshot.volumeAvg20!, 2);

        // RSI & stochastic dalam rentang 0-100, ATR positif.
        expect(snapshot.rsi14!).toBeGreaterThanOrEqual(0);
        expect(snapshot.rsi14!).toBeLessThanOrEqual(100);
        expect(snapshot.stochasticK!).toBeGreaterThanOrEqual(0);
        expect(snapshot.stochasticD!).toBeLessThanOrEqual(100);
        expect(snapshot.atr14!).toBeGreaterThan(0);
    });
});
