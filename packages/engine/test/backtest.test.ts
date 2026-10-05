import { describe, expect, it } from "vitest";
import type { RuleConfig } from "@stock-analyst/shared";
import type { Candle } from "../src/indicators";
import { backtest, type BacktestParams } from "../src/backtest";

const BASE_PARAMS: BacktestParams = {
    initialBalance: 10_000_000,
    feePct: 0.15,
    stopLossPct: 5,
    takeProfitPct: 10,
    positionSizePct: 20,
};

function sineCandles(length = 120): Candle[] {
    return Array.from({ length }, (_, i) => ({
        open: 100 + Math.sin(i / 5) * 3,
        high: 100 + Math.sin(i / 5) * 3 + 1,
        low: 100 + Math.sin(i / 5) * 3 - 1,
        close: 100 + Math.sin(i / 5) * 3,
        volume: 1000,
    }));
}

const ENTRY: RuleConfig[] = [{ type: "RSI_OVERSOLD", params: { threshold: 40 } }];
const EXIT: RuleConfig[] = [{ type: "RSI_OVERBOUGHT", params: { threshold: 60 } }];

describe("backtest — slippage & tanggal trade", () => {
    it("slippagePct 0 menghasilkan nilai yang sama dengan tanpa slippage", () => {
        const candles = sineCandles();
        const without = backtest(candles, ENTRY, EXIT, BASE_PARAMS);
        const withZero = backtest(candles, ENTRY, EXIT, { ...BASE_PARAMS, slippagePct: 0 });
        expect(withZero.totalPnl).toBe(without.totalPnl);
        expect(withZero.trades).toEqual(without.trades);
    });

    it("slippage memperburuk harga masuk dan harga keluar", () => {
        const candles = sineCandles();
        const without = backtest(candles, ENTRY, EXIT, BASE_PARAMS);
        const withSlip = backtest(candles, ENTRY, EXIT, { ...BASE_PARAMS, slippagePct: 1 });

        expect(without.trades.length).toBeGreaterThan(0);
        expect(withSlip.trades.length).toBe(without.trades.length);

        withSlip.trades.forEach((trade, idx) => {
            const plain = without.trades[idx]!;
            expect(trade.entryPrice).toBeCloseTo(candles[trade.entryDate]!.close * 1.01, 6);
            expect(trade.entryPrice).toBeGreaterThan(plain.entryPrice);
            expect(trade.exitPrice!).toBeLessThan(plain.exitPrice!);
        });
    });

    it("entryDate/exitDate memakai timestamp candle bila tersedia", () => {
        const start = Date.UTC(2026, 0, 2);
        const day = 24 * 60 * 60 * 1000;
        const candles = sineCandles().map((candle, i) => ({ ...candle, timestamp: start + i * day }));
        const result = backtest(candles, ENTRY, EXIT, BASE_PARAMS);

        expect(result.trades.length).toBeGreaterThan(0);
        for (const trade of result.trades) {
            expect((trade.entryDate - start) % day).toBe(0);
            expect(trade.exitDate).not.toBeNull();
            expect((trade.exitDate! - start) % day).toBe(0);
        }
    });
});
