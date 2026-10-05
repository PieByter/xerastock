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
    /** sinyal yang memicu order ini (opsional, untuk jejak audit). */
    signalId?: string;
}

export interface OrderResult {
    filled: boolean;
    fillPrice: number;
    fee: number;
    /** PnL realisasi (hanya untuk SELL yang berhasil menutup posisi). */
    pnl?: number;
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

        const position = await this.prisma.position.findUnique({
            where: {
                strategyId_stockId_mode: {
                    strategyId: req.strategyId,
                    stockId: req.stockId,
                    mode: "PAPER",
                },
            },
        });

        // Tidak boleh menjual tanpa posisi — mencegah posisi qty negatif.
        if (req.side === "SELL") {
            if (!position || position.qty < req.qty) {
                logger.warn({ ticker: req.ticker }, "tidak ada posisi paper yang bisa dijual");
                return { filled: false, fillPrice, fee, reason: "NO_POSITION" };
            }
        }

        // Trade masuk yang masih terbuka — dipakai untuk menutup statusnya dan
        // mewariskan signalId supaya hasil (PnL) bisa ditelusuri ke sinyal asal.
        const openEntries =
            req.side === "SELL"
                ? await this.prisma.trade.findMany({
                      where: { strategyId: req.strategyId, stockId: req.stockId, mode: "PAPER", side: "BUY", status: "OPEN" },
                      orderBy: { openedAt: "asc" },
                  })
                : [];
        const entrySignalId = openEntries[0]?.signalId ?? null;

        // PnL realisasi dihitung dari harga rata-rata masuk posisi.
        const avgEntry = position ? Number(position.avgEntry) : fillPrice;
        const pnl = req.side === "SELL" ? (fillPrice - avgEntry) * req.qty - fee : undefined;

        // Simpan trade
        await this.prisma.trade.create({
            data: {
                strategyId: req.strategyId,
                signalId: req.signalId ?? entrySignalId,
                stockId: req.stockId,
                side: req.side,
                mode: "PAPER",
                qty: req.qty,
                price: fillPrice,
                fee,
                pnl: pnl ?? null,
                status: req.side === "SELL" ? "CLOSED" : "OPEN",
                closedAt: req.side === "SELL" ? new Date() : null,
                requestId: req.requestId,
                decisionLogJson: { slippagePct: SLIPPAGE_PCT, feePct: FEE_PCT, avgEntry },
            },
        });

        // Tutup trade masuk bila posisi benar-benar habis.
        if (req.side === "SELL" && openEntries.length > 0 && position && position.qty <= req.qty) {
            await this.prisma.trade.updateMany({
                where: { id: { in: openEntries.map((trade) => trade.id) } },
                data: { status: "CLOSED", closedAt: new Date() },
            });
        }

        // Update saldo & posisi
        const newBalance =
            req.side === "BUY"
                ? Number(account.balance) - gross - fee
                : Number(account.balance) + gross - fee;

        await this.prisma.paperAccount.update({
            where: { id: account.id },
            data: { balance: newBalance },
        });

        if (req.side === "BUY") {
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
                    qty: { increment: req.qty },
                    currentValue: gross,
                },
            });
        } else if (position && position.qty > req.qty) {
            // Keluar sebagian: sisa posisi tetap terbuka.
            await this.prisma.position.update({
                where: { id: position.id },
                data: { qty: position.qty - req.qty },
            });
        } else if (position) {
            // Posisi habis → hapus supaya hitungan max posisi & portofolio akurat.
            await this.prisma.position.delete({ where: { id: position.id } });
        }

        logger.info(
            { ticker: req.ticker, side: req.side, qty: req.qty, fillPrice, pnl },
            "paper order terisi",
        );
        return { filled: true, fillPrice, fee, pnl };
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