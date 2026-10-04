import { describe, it, expect } from "vitest";
import { keyStats, supportResistance, swingPoints } from "../src/stats";
import type { Candle } from "../src/indicators";

function candle(close: number, high = close * 1.01, low = close * 0.99, volume = 1_000): Candle {
    return { open: close, high, low, close, volume };
}

describe("keyStats", () => {
    it("mengembalikan null saat candle kurang dari 2", () => {
        expect(keyStats([])).toBeNull();
        expect(keyStats([candle(100)])).toBeNull();
    });

    it("menghitung rentang 52 minggu dan jarak dari high", () => {
        const candles = Array.from({ length: 30 }, (_, i) => candle(100 + i));
        const stats = keyStats(candles)!;

        expect(stats.lastClose).toBe(129);
        expect(stats.high52w).toBeCloseTo(129 * 1.01);
        expect(stats.low52w).toBeCloseTo(100 * 0.99);
        expect(stats.pctFromHigh).toBeLessThan(0);
        expect(stats.rangePosition).toBeGreaterThan(0.9);
    });

    it("menghitung perubahan 1 minggu dari 5 candle sebelumnya", () => {
        const closes = [100, 100, 100, 100, 100, 110];
        const stats = keyStats(closes.map((c) => candle(c)))!;
        expect(stats.change1w).toBeCloseTo(10);
    });

    it("mendeteksi drawdown dari puncak berjalan", () => {
        const closes = [100, 120, 60, 80];
        const stats = keyStats(closes.map((c) => candle(c)))!;
        expect(stats.maxDrawdown).toBeCloseTo(-50);
    });

    it("menghitung rasio volume terhadap rata-rata 20 hari", () => {
        const candles = [
            ...Array.from({ length: 20 }, () => candle(100, 101, 99, 1_000)),
            candle(100, 101, 99, 3_000),
        ];
        const stats = keyStats(candles)!;
        expect(stats.avgVolume20).toBe(1_100);
        expect(stats.volumeRatio).toBeCloseTo(2.73, 2);
    });

    it("volatilitas nol saat harga datar, ATR dari rentang high-low", () => {
        const stats = keyStats(Array.from({ length: 25 }, () => candle(100)))!;
        expect(stats.volatility20).toBeCloseTo(0);
        expect(stats.atrPct).toBeCloseTo(2);
    });
});

describe("swingPoints", () => {
    it("menemukan satu swing high dan satu swing low pada pola V terbalik", () => {
        const closes = [10, 11, 12, 13, 14, 13, 12, 11, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11];
        const candles = closes.map((c) => candle(c, c + 0.5, c - 0.5));
        const { highs, lows } = swingPoints(candles, 3);

        expect(highs.length).toBeGreaterThan(0);
        expect(lows.length).toBeGreaterThan(0);
        expect(Math.max(...highs.map((h) => h.price))).toBeCloseTo(15.5);
    });

    it("kosong saat data terlalu pendek", () => {
        expect(swingPoints([candle(100), candle(101)], 5)).toEqual({ highs: [], lows: [] });
    });
});

describe("supportResistance", () => {
    const closes = [10, 11, 12, 13, 14, 13, 12, 11, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11];
    const candles = closes.map((c) => candle(c, c + 0.5, c - 0.5));

    it("memisahkan level di bawah dan di atas harga terakhir", () => {
        const { supports, resistances } = supportResistance(candles, { lookback: 3 });

        expect(supports.every((level) => level.price < 11)).toBe(true);
        expect(resistances.every((level) => level.price > 11)).toBe(true);
        expect(supports.length + resistances.length).toBeGreaterThan(0);
    });

    it("mengurutkan level terdekat lebih dulu", () => {
        const { supports } = supportResistance(candles, { lookback: 3 });
        const prices = supports.map((s) => s.price);
        expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    it("menghormati maxLevels", () => {
        const { supports, resistances } = supportResistance(candles, { lookback: 1, maxLevels: 1 });
        expect(supports.length).toBeLessThanOrEqual(1);
        expect(resistances.length).toBeLessThanOrEqual(1);
    });

    it("kosong saat data tidak cukup", () => {
        expect(supportResistance([candle(100), candle(101)], { lookback: 5 })).toEqual({
            supports: [],
            resistances: [],
        });
    });
});
