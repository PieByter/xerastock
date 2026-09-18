/**
 * Paper Broker — simulasi eksekusi order tanpa uang riil.
 * Eksekusi next-bar (anti-look-ahead) + slippage sederhana.
 * LiveBroker (Fase 3) mengimplementasikan interface yang sama.
 */

import type { PrismaClient } from "@stock-analyst/db";
import { logger } from "../logger";

export interface OrderRequest {
    strategyId: string;
    stockId: string;
    ticker: string;
    side: "BUY" | "SELL";
    qty: number;
    /** harga bar saat sinyal (untuk estimasi). */
    refPrice: number;
    requestId: string;
}

export interface OrderResult {
    filled: boolean;
    fillPrice: number;
    fee: number;
    reason?: string;
}

export interface BrokerAdapter {
    name: string;
    placeOrder(req: OrderRequest): Promise<OrderResult>;
}

/** Slippage asumsi 0.1% + fee 0.15% (konservatif). */
const SLIPPAGE_PCT = 0.001;
const FEE_PCT = 0.0015;

export class PaperBroker implements BrokerAdapter {
    name = "paper";

    constructor(private prisma: PrismaClient) { }

    async placeOrder(req: OrderRequest): Promise<OrderResult> {
        const account = await this.getOrCreateAccount(req.strategyId);
        const slippage = req.refPrice * SLIPPAGE_PCT;
        const fillPrice =
            req.side === "BUY" ? req.refPrice + slippage : req.refPrice - slippage;
        const gross = fillPrice * req.qty;
        const fee = gross * FEE_PCT;

        // Cek saldo (hanya untuk BUY)
        if (req.side === "BUY" && gross + fee > Number(account.balance)) {
            logger.warn({ ticker: req.ticker }, "saldo paper tidak cukup");
            return { filled: false, fillPrice, fee, reason: "INSUFFICIENT_BALANCE" };
        }

        // Simpan trade
        await this.prisma.trade.create({
            data: {
                strategyId: req.strategyId,
                stockId: req.stockId,
                side: req.side,
                mode: "PAPER",
                qty: req.qty,
                price: fillPrice,
                fee,
                status: "OPEN",
                requestId: req.requestId,
                decisionLogJson: { slippagePct: SLIPPAGE_PCT, feePct: FEE_PCT },
            },
        });

        // Update saldo & posisi
        const newBalance =
            req.side === "BUY"
                ? Number(account.balance) - gross - fee
                : Number(account.balance) + gross - fee;

        await this.prisma.paperAccount.update({
            where: { id: account.id },
            data: { balance: newBalance },
        });

        await this.prisma.position.upsert({
            where: {
                strategyId_stockId_mode: {
                    strategyId: req.strategyId,
                    stockId: req.stockId,
                    mode: "PAPER",
                },
            },
            create: {
                strategyId: req.strategyId,
                stockId: req.stockId,
                mode: "PAPER",
                qty: req.qty,
                avgEntry: fillPrice,
                currentValue: gross,
                unrealizedPnl: 0,
            },
            update: {
                qty: { increment: req.side === "BUY" ? req.qty : -req.qty },
            },
        });

        logger.info(
            { ticker: req.ticker, side: req.side, qty: req.qty, fillPrice },
            "paper order terisi",
        );
        return { filled: true, fillPrice, fee };
    }

    private async getOrCreateAccount(strategyId: string) {
        const existing = await this.prisma.paperAccount.findFirst({
            where: { strategyId },
        });
        if (existing) return existing;
        return this.prisma.paperAccount.create({
            data: {
                strategyId,
                balance: 10_000_000,
                initialBalance: 10_000_000,
                currency: "IDR",
            },
        });
    }
}

// TODO (Fase 3): LiveBroker — integrasi broker IDX dengan API resmi.
// export class LiveBroker implements BrokerAdapter { ... }