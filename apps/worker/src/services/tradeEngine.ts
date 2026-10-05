/**
 * Trade Engine — menyambungkan sinyal ke eksekusi paper trading.
 *
 * Alur: sinyal BUY → cek guardrail → hitung ukuran posisi dari risk params →
 * `BrokerAdapter.placeOrder`. Sinyal SELL → tutup posisi. Posisi terbuka juga
 * dipantau terhadap stop loss / take profit oleh `monitorPositionExits`.
 *
 * Semua aksi hanya jalan bila BotConfig mengizinkan: kill switch mati,
 * mode PAPER, dan status RUNNING. Live trading (Fase 3) memakai adapter lain
 * tanpa mengubah file ini.
 */

import type { PrismaClient } from "@stock-analyst/db";
import { DEFAULT_RISK_PARAMS, type NotificationPayload, type RiskParams } from "@stock-analyst/shared";
import type { BrokerAdapter } from "./paperBroker";
import { logger } from "../logger";

/** IDX memperdagangkan saham per lot (100 lembar). */
const LOT_SIZE = 100;

export interface TradeGate {
    allowed: boolean;
    reason?: string;
}

/** Master switch trading: kill switch, mode, dan status bot. */
export async function tradingGate(prisma: PrismaClient): Promise<TradeGate> {
    const config = await prisma.botConfig.findFirst();
    if (!config) return { allowed: false, reason: "BotConfig belum ada" };
    if (config.killSwitch) return { allowed: false, reason: "kill switch aktif" };
    if (config.status !== "RUNNING") return { allowed: false, reason: `bot ${config.status}` };
    if (config.mode !== "PAPER") return { allowed: false, reason: `mode ${config.mode}` };
    return { allowed: true };
}

function riskParamsOf(strategy: { riskParamsJson: unknown }): RiskParams {
    return { ...DEFAULT_RISK_PARAMS, ...(strategy.riskParamsJson as Partial<RiskParams> | null) };
}

/** Batas kerugian harian: total PnL realisasi hari ini. */
async function dailyRealizedPnl(prisma: PrismaClient): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const trades = await prisma.trade.findMany({
        where: { mode: "PAPER", closedAt: { gte: startOfDay }, pnl: { not: null } },
        select: { pnl: true },
    });
    return trades.reduce((sum, trade) => sum + Number(trade.pnl ?? 0), 0);
}

/**
 * Ukuran posisi dari risiko per posisi: qty = (saldo × risk%) ÷ jarak stop loss.
 * Dibulatkan ke bawah per lot dan dibatasi kas yang tersedia.
 */
export function positionSize(opts: {
    balance: number;
    price: number;
    riskPerPositionPct: number;
    stopLossPct: number;
}): number {
    const { balance, price, riskPerPositionPct, stopLossPct } = opts;
    if (price <= 0) return 0;

    const riskAmount = balance * (riskPerPositionPct / 100);
    const stopDistance = price * (stopLossPct / 100);
    if (stopDistance <= 0) return 0;

    const byRisk = Math.floor(riskAmount / stopDistance / LOT_SIZE) * LOT_SIZE;
    // Sisakan ruang untuk slippage + fee agar order tidak ditolak saldo.
    const byCash = Math.floor(balance / (price * 1.01) / LOT_SIZE) * LOT_SIZE;
    return Math.max(0, Math.min(byRisk, byCash));
}

async function notify(
    prisma: PrismaClient,
    title: string,
    description: string,
    color: number,
    fields: Array<{ name: string; value: string; inline?: boolean }>,
): Promise<void> {
    const payload: NotificationPayload = { type: "TRADE_EXECUTED", title, description, color, fields };
    await prisma.alertEvent.create({
        data: {
            type: "TRADE_EXECUTED",
            sentTo: "discord",
            status: "QUEUED",
            payloadJson: JSON.parse(JSON.stringify(payload)),
        },
    });
}

export interface ExecuteOptions {
    prisma: PrismaClient;
    broker: BrokerAdapter;
    strategyId: string;
    stockId: string;
    ticker: string;
    signalId?: string;
    direction: "BUY" | "SELL" | "WATCH";
    price: number;
    reasons: string[];
}

/** Eksekusi sinyal: BUY membuka posisi, SELL menutup posisi. */
export async function executeSignal(opts: ExecuteOptions): Promise<string> {
    const { prisma, broker, strategyId, stockId, ticker, signalId, direction, price, reasons } = opts;
    if (direction === "WATCH") return "skipped:watch";

    const gate = await tradingGate(prisma);
    if (!gate.allowed) return `skipped:${gate.reason}`;

    const strategy = await prisma.strategy.findUnique({ where: { id: strategyId } });
    if (!strategy) return "skipped:strategi tidak ada";

    const risk = riskParamsOf(strategy);
    const account = await prisma.paperAccount.findFirst({ where: { strategyId } });
    const balance = account ? Number(account.balance) : 10_000_000;

    if (direction === "SELL") return closePosition(opts, risk);

    // --- ENTRY ---
    const existing = await prisma.position.findUnique({
        where: { strategyId_stockId_mode: { strategyId, stockId, mode: "PAPER" } },
    });
    if (existing) return "skipped:sudah punya posisi";

    const openCount = await prisma.position.count({ where: { mode: "PAPER" } });
    if (openCount >= risk.maxPositions) return "skipped:max posisi tercapai";

    const realized = await dailyRealizedPnl(prisma);
    const lossLimit = -(balance * (risk.dailyLossLimitPct / 100));
    if (realized <= lossLimit) return "skipped:daily loss limit";

    const qty = positionSize({
        balance,
        price,
        riskPerPositionPct: risk.riskPerPositionPct,
        stopLossPct: risk.stopLossPct,
    });
    if (qty < LOT_SIZE) return "skipped:ukuran posisi terlalu kecil";

    const result = await broker.placeOrder({
        strategyId,
        stockId,
        ticker,
        side: "BUY",
        qty,
        refPrice: price,
        requestId: crypto.randomUUID(),
        signalId,
    });
    if (!result.filled) return `gagal:${result.reason}`;

    await notify(
        prisma,
        `📈 PAPER BUY — ${ticker}`,
        reasons.join(" · "),
        0x22c55e,
        [
            { name: "Qty", value: `${qty.toLocaleString("id-ID")} (${qty / LOT_SIZE} lot)`, inline: true },
            { name: "Harga", value: `Rp ${Math.round(result.fillPrice).toLocaleString("id-ID")}`, inline: true },
            { name: "Fee", value: `Rp ${Math.round(result.fee).toLocaleString("id-ID")}`, inline: true },
            { name: "Stop loss", value: `Rp ${Math.round(result.fillPrice * (1 - risk.stopLossPct / 100)).toLocaleString("id-ID")}`, inline: true },
            { name: "Take profit", value: `Rp ${Math.round(result.fillPrice * (1 + risk.takeProfitPct / 100)).toLocaleString("id-ID")}`, inline: true },
        ],
    );

    logger.info({ ticker, qty, price: result.fillPrice }, "posisi paper dibuka");
    return "filled:buy";
}

/** Tutup posisi terbuka pada sinyal SELL. */
async function closePosition(opts: ExecuteOptions, risk: RiskParams): Promise<string> {
    const { prisma, broker, strategyId, stockId, ticker, signalId, price, reasons } = opts;

    const position = await prisma.position.findUnique({
        where: { strategyId_stockId_mode: { strategyId, stockId, mode: "PAPER" } },
    });
    if (!position) return "skipped:tidak ada posisi";

    const result = await broker.placeOrder({
        strategyId,
        stockId,
        ticker,
        side: "SELL",
        qty: position.qty,
        refPrice: price,
        requestId: crypto.randomUUID(),
        signalId,
    });
    if (!result.filled) return `gagal:${result.reason}`;

    const pnl = result.pnl ?? 0;
    await notify(
        prisma,
        `${pnl >= 0 ? "✅" : "🛑"} PAPER SELL — ${ticker}`,
        reasons.join(" · "),
        pnl >= 0 ? 0x22c55e : 0xef4444,
        [
            { name: "Qty", value: position.qty.toLocaleString("id-ID"), inline: true },
            { name: "Harga keluar", value: `Rp ${Math.round(result.fillPrice).toLocaleString("id-ID")}`, inline: true },
            { name: "PnL", value: `Rp ${Math.round(pnl).toLocaleString("id-ID")}`, inline: true },
            { name: "Stop loss", value: `${risk.stopLossPct}%`, inline: true },
        ],
    );

    logger.info({ ticker, pnl }, "posisi paper ditutup oleh sinyal");
    return "filled:sell";
}

/**
 * Pantau posisi terbuka terhadap stop loss & take profit.
 * Dipanggil saat refresh quote (jam bursa) dan di pipeline EOD.
 */
export async function monitorPositionExits(prisma: PrismaClient, broker: BrokerAdapter): Promise<number> {
    const gate = await tradingGate(prisma);
    if (!gate.allowed) return 0;

    const positions = await prisma.position.findMany({
        where: { mode: "PAPER" },
        include: {
            stock: { include: { priceBars: { orderBy: { timestamp: "desc" }, take: 1 } } },
            strategy: true,
        },
    });

    let closed = 0;

    for (const position of positions) {
        const lastBar = position.stock.priceBars[0];
        if (!lastBar) continue;

        const price = Number(lastBar.close);
        const entry = Number(position.avgEntry);
        if (price <= 0 || entry <= 0) continue;

        const risk = riskParamsOf(position.strategy);
        const stopPrice = entry * (1 - risk.stopLossPct / 100);
        const targetPrice = entry * (1 + risk.takeProfitPct / 100);

        const hitStop = price <= stopPrice;
        const hitTarget = price >= targetPrice;

        // Update nilai posisi supaya halaman portofolio selalu segar.
        await prisma.position.update({
            where: { id: position.id },
            data: {
                currentValue: price * position.qty,
                unrealizedPnl: (price - entry) * position.qty,
            },
        });

        if (!hitStop && !hitTarget) continue;

        const result = await broker.placeOrder({
            strategyId: position.strategyId,
            stockId: position.stockId,
            ticker: position.stock.ticker,
            side: "SELL",
            qty: position.qty,
            refPrice: price,
            requestId: crypto.randomUUID(),
        });
        if (!result.filled) continue;

        const pnl = result.pnl ?? 0;
        const label = hitStop ? "STOP LOSS" : "TAKE PROFIT";
        await notify(
            prisma,
            `${hitStop ? "🛑" : "🎯"} PAPER ${label} — ${position.stock.ticker}`,
            `Posisi ditutup otomatis pada ${label.toLowerCase()} (${risk.stopLossPct}% / ${risk.takeProfitPct}%).`,
            hitStop ? 0xef4444 : 0x22c55e,
            [
                { name: "Harga keluar", value: `Rp ${Math.round(result.fillPrice).toLocaleString("id-ID")}`, inline: true },
                { name: "Avg entry", value: `Rp ${Math.round(entry).toLocaleString("id-ID")}`, inline: true },
                { name: "PnL", value: `Rp ${Math.round(pnl).toLocaleString("id-ID")}`, inline: true },
            ],
        );
        logger.info({ ticker: position.stock.ticker, label, pnl }, "posisi paper ditutup otomatis");
        closed++;
    }

    return closed;
}
