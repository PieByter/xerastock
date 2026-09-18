import { describe, it, expect } from "vitest";
import { sma, ema, rsi, macd, bollinger, atr } from "../src/indicators";
import { evaluateRules } from "../src/rules";
import { backtest } from "../src/backtest";
import type { Candle } from "../src/indicators";

describe("sma", () => {
    it("menghitung SMA 3 dengan benar", () => {
        const out = sma([1, 2, 3, 4, 5], 3);
        expect(out[0]).toBeNull();
        expect(out[1]).toBeNull();
        expect(out[2]).toBeCloseTo(2);
        expect(out[3]).toBeCloseTo(3);
        expect(out[4]).toBeCloseTo(4);
    });
});

describe("rsi", () => {
    it("RSI = 100 saat semua naik", () => {
        const values = Array.from({ length: 20 }, (_, i) => 100 + i);
        const out = rsi(values, 14);
        expect(out[out.length - 1]).toBeCloseTo(100);
    });

    it("RSI = 0 saat semua turun", () => {
        const values = Array.from({ length: 20 }, (_, i) => 100 - i);
        const out = rsi(values, 14);
        expect(out[out.length - 1]).toBeCloseTo(0);
    });
});

describe("macd", () => {
    it("menghasilkan histogram", () => {
        const values = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 5);
        const { histogram } = macd(values);
        expect(histogram.length).toBe(40);
        expect(histogram[histogram.length - 1]).not.toBeNull();
    });
});

describe("bollinger", () => {
    it("upper >= middle >= lower", () => {
        const values = Array.from({ length: 30 }, (_, i) => 100 + i);
        const { upper, middle, lower } = bollinger(values, 20);
        const i = values.length - 1;
        expect(upper[i]!).toBeGreaterThanOrEqual(middle[i]!);
        expect(middle[i]!).toBeGreaterThanOrEqual(lower[i]!);
    });
});

describe("atr", () => {
    it("menghasilkan nilai positif", () => {
        const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
            open: 100 + i,
            high: 102 + i,
            low: 99 + i,
            close: 101 + i,
            volume: 1000,
        }));
        const out = atr(candles, 14);
        expect(out[out.length - 1]!).toBeGreaterThan(0);
    });
});

describe("evaluateRules", () => {
    const uptrend: Candle[] = Array.from({ length: 60 }, (_, i) => ({
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100.5 + i,
        volume: 1000,
    }));

    it("mendeteksi harga di atas MA50 (BUY)", () => {
        const sig = evaluateRules(
            [{ type: "PRICE_ABOVE_MA", params: { period: 50 } }],
            [],
            { candles: uptrend },
        );
        expect(sig?.direction).toBe("BUY");
    });

    it("tidak menghasilkan sinyal saat data kurang", () => {
        const sig = evaluateRules(
            [{ type: "PRICE_ABOVE_MA", params: { period: 50 } }],
            [],
            { candles: uptrend.slice(0, 10) },
        );
        expect(sig).toBeNull();
    });
});

describe("backtest", () => {
    it("menjalankan backtest tanpa error dan menghasilkan trade", () => {
        const candles: Candle[] = Array.from({ length: 120 }, (_, i) => ({
            open: 100 + Math.sin(i / 5) * 3,
            high: 100 + Math.sin(i / 5) * 3 + 1,
            low: 100 + Math.sin(i / 5) * 3 - 1,
            close: 100 + Math.sin(i / 5) * 3,
            volume: 1000,
        }));
        const result = backtest(
            candles,
            [{ type: "RSI_OVERSOLD", params: { threshold: 40 } }],
            [{ type: "RSI_OVERBOUGHT", params: { threshold: 60 } }],
            {
                initialBalance: 10_000_000,
                feePct: 0.15,
                stopLossPct: 5,
                takeProfitPct: 10,
                positionSizePct: 20,
            },
        );
        expect(result.finalBalance).toBeGreaterThan(0);
        expect(result.trades.length).toBeGreaterThan(0);
    });
});