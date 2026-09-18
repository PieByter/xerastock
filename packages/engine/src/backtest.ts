/**
 * Backtest sederhana (next-bar execution, anti-look-ahead).
 * Digunakan untuk validasi strategi (KPI-4) dan paper trading.
 */

import type { Candle } from "./indicators";
import type { RuleConfig } from "@stock-analyst/shared";
import { evaluateRules } from "./rules";

export interface BacktestParams {
    initialBalance: number;
    feePct: number; // biaya per transaksi (mis. 0.15%)
    stopLossPct: number;
    takeProfitPct: number;
    positionSizePct: number; // % balance per posisi
}

export interface BacktestTrade {
    entryDate: number;
    entryPrice: number;
    exitDate: number | null;
    exitPrice: number | null;
    qty: number;
    pnl: number;
    pnlPct: number;
    exitReason: "SIGNAL" | "STOP_LOSS" | "TAKE_PROFIT" | "OPEN";
}

export interface BacktestResult {
    trades: BacktestTrade[];
    totalPnl: number;
    totalPnlPct: number;
    winRate: number;
    profitFactor: number;
    maxDrawdownPct: number;
    finalBalance: number;
}

/**
 * Jalankan backtest. Sinyal di bar i dieksekusi di bar i+1 (next-bar).
 */
export function backtest(
    candles: Candle[],
    entryRules: RuleConfig[],
    exitRules: RuleConfig[],
    params: BacktestParams,
): BacktestResult {
    let balance = params.initialBalance;
    let position: { qty: number; entryPrice: number; entryIndex: number } | null = null;
    const trades: BacktestTrade[] = [];
    let peakBalance = balance;
    let maxDrawdownPct = 0;

    for (let i = 1; i < candles.length; i++) {
        const bar = candles[i]!;

        // Exit check (jika ada posisi)
        if (position) {
            const stopPrice = position.entryPrice * (1 - params.stopLossPct / 100);
            const tpPrice = position.entryPrice * (1 + params.takeProfitPct / 100);
            let exitPrice: number | null = null;
            let exitReason: BacktestTrade["exitReason"] = "OPEN";

            if (bar.low <= stopPrice) {
                exitPrice = stopPrice;
                exitReason = "STOP_LOSS";
            } else if (bar.high >= tpPrice) {
                exitPrice = tpPrice;
                exitReason = "TAKE_PROFIT";
            } else {
                const sig = evaluateRules(entryRules, exitRules, { candles: candles.slice(0, i) });
                if (sig?.direction === "SELL") {
                    exitPrice = bar.close;
                    exitReason = "SIGNAL";
                }
            }

            if (exitPrice != null) {
                const gross = position.qty * exitPrice;
                const fee = gross * (params.feePct / 100);
                const pnl = gross - position.qty * position.entryPrice - fee;
                balance += pnl;
                trades.push({
                    entryDate: candles[position.entryIndex]!.open,
                    entryPrice: position.entryPrice,
                    exitDate: bar.open,
                    exitPrice,
                    qty: position.qty,
                    pnl,
                    pnlPct: (pnl / (position.qty * position.entryPrice)) * 100,
                    exitReason,
                });
                position = null;
                peakBalance = Math.max(peakBalance, balance);
                maxDrawdownPct = Math.max(maxDrawdownPct, ((peakBalance - balance) / peakBalance) * 100);
            }
        }

        // Entry check (jika tidak ada posisi)
        if (!position) {
            const sig = evaluateRules(entryRules, exitRules, { candles: candles.slice(0, i) });
            if (sig?.direction === "BUY") {
                const alloc = balance * (params.positionSizePct / 100);
                const qty = Math.floor(alloc / bar.close);
                if (qty > 0) {
                    position = { qty, entryPrice: bar.close, entryIndex: i };
                }
            }
        }
    }

    // Tutup posisi terbuka di akhir
    if (position) {
        const last = candles[candles.length - 1]!;
        const gross = position.qty * last.close;
        const fee = gross * (params.feePct / 100);
        const pnl = gross - position.qty * position.entryPrice - fee;
        balance += pnl;
        trades.push({
            entryDate: candles[position.entryIndex]!.open,
            entryPrice: position.entryPrice,
            exitDate: last.open,
            exitPrice: last.close,
            qty: position.qty,
            pnl,
            pnlPct: (pnl / (position.qty * position.entryPrice)) * 100,
            exitReason: "OPEN",
        });
    }

    const closed = trades.filter((t) => t.exitReason !== "OPEN");
    const wins = closed.filter((t) => t.pnl > 0);
    const grossProfit = closed.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(closed.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0));

    return {
        trades,
        totalPnl: balance - params.initialBalance,
        totalPnlPct: ((balance - params.initialBalance) / params.initialBalance) * 100,
        winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
        maxDrawdownPct,
        finalBalance: balance,
    };
}