import { describe, it, expect } from "vitest";
import { sma, ema, rsi, macd, bollinger, atr, stochastic } from "../src/indicators";
import { evaluateRules, evaluateBsjp, evaluateBpjs, evaluateSwing, detectBrokerAccumulation } from "../src/rules";
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

describe("stochastic", () => {
    it("menghitung %K dan %D tanpa error", () => {
        const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
            open: 100 + i,
            high: 102 + i,
            low: 99 + i,
            close: 101 + i,
            volume: 5000,
        }));
        const res = stochastic(candles, 14, 3, 3);
        expect(res.k.length).toBe(30);
        expect(res.d.length).toBe(30);
        const lastK = res.k[res.k.length - 1];
        expect(lastK).not.toBeNull();
    });
});

describe("IDX Trading Strategies (PRD §10.1)", () => {
    it("BSJP mendeteksi volume spike + foreign net buy + bullish close", () => {
        const candles: Candle[] = Array.from({ length: 25 }, () => ({
            open: 1000,
            high: 1010,
            low: 990,
            close: 1000,
            volume: 10_000,
        }));
        // Bar terakhir dengan volume spike dan closing dekat high
        candles.push({
            open: 1000,
            high: 1060,
            low: 995,
            close: 1055, // 1055 dekat 1060 (high)
            volume: 25_000, // 2.5x rata-rata
        });

        const sig = evaluateBsjp({
            candles,
            foreignFlow: { todayNetForeign: 5_000_000 },
        });

        expect(sig).not.toBeNull();
        expect(sig?.strategyType).toBe("BSJP");
        expect(sig?.direction).toBe("BUY");
        expect(sig?.strength).toBeGreaterThanOrEqual(0.65);
    });

    it("BPJS mendeteksi gap up pagi dan momentum", () => {
        const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
            open: 5000 + i * 5,
            high: 5050 + i * 5,
            low: 4980 + i * 5,
            close: 5020 + i * 5,
            volume: 50_000,
        }));
        // Candle hari ini: gap up
        candles.push({
            open: 5180, // gap up dibanding kemarin 5115
            high: 5225,
            low: 5160,
            close: 5200,
            volume: 75_000,
        });

        const sig = evaluateBpjs({
            candles,
        });

        expect(sig).not.toBeNull();
        expect(sig?.strategyType).toBe("BPJS");
        expect(sig?.direction).toBe("BUY");
    });

    it("Swing mendeteksi tren akumulasi dan membatalkan jika ada berita negatif", () => {
        const candles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
            open: 8000 + i * 20,
            high: 8050 + i * 20,
            low: 7980 + i * 20,
            close: 8030 + i * 20,
            volume: 100_000,
        }));

        // Dengan akumulasi positif dan tanpa berita negatif
        const sig = evaluateSwing({
            candles,
            foreignFlow: { multiDayNetForeign: 15_000_000 },
            sentiment: { hasNegativeNews: false },
        });
        expect(sig).not.toBeNull();
        expect(sig?.strategyType).toBe("SWING");

        // Jika ada berita negatif, sinyal harus null (guardrail)
        const sigWithBadNews = evaluateSwing({
            candles,
            foreignFlow: { multiDayNetForeign: 15_000_000 },
            sentiment: { hasNegativeNews: true },
        });
        expect(sigWithBadNews).toBeNull();
    });

    it("detectBrokerAccumulation menandai broker dengan net buy ≥ 3 hari berturut-turut", () => {
        const history = [
            { date: "2026-09-15", brokerCode: "YP", netValue: 1_000_000 },
            { date: "2026-09-16", brokerCode: "YP", netValue: 2_000_000 },
            { date: "2026-09-17", brokerCode: "YP", netValue: 1_500_000 },
            { date: "2026-09-17", brokerCode: "CC", netValue: -500_000 },
        ];

        const alerts = detectBrokerAccumulation(history);
        expect(alerts.length).toBe(1);
        expect(alerts[0]!.brokerCode).toBe("YP");
        expect(alerts[0]!.consecutiveDays).toBe(3);
        expect(alerts[0]!.message).toContain("Broker YP net buy 3 hari berturut-turut");
    });
});