/**
 * Mutasi tulis (server-only) untuk UI: watchlist, pengaturan bot, risk params.
 *
 * Semua fungsi mengembalikan `ActionResult` dan menolak dengan pesan jelas
 * bila `DATABASE_URL` belum di-set (mode demo) — UI tidak pernah crash.
 * Hanya boleh diimpor dari server action / server code.
 */

import { prisma } from "@stock-analyst/db";
import { isAuthenticated } from "@/lib/auth";

export interface ActionResult {
    ok: boolean;
    message: string;
}

export type BotMode = "SIGNAL_ONLY" | "PAPER" | "LIVE";
export type BotRunStatus = "RUNNING" | "STOPPED";

export interface RiskParamsInput {
    stopLossPct: number;
    takeProfitPct: number;
    riskPerPositionPct: number;
    dailyLossLimitPct: number;
    maxPositions: number;
}

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@xerastock.local";

function dbGuard(): ActionResult | null {
    return process.env.DATABASE_URL
        ? null
        : { ok: false, message: "DATABASE_URL belum di-set — perubahan tidak bisa disimpan (mode demo)." };
}

/** Pertahanan berlapis: middleware sudah menjaga, tapi aksi tulis dicek ulang. */
function authGuard(): ActionResult | null {
    return isAuthenticated() ? null : { ok: false, message: "Sesi tidak valid — silakan login ulang." };
}

function guard(): ActionResult | null {
    return authGuard() ?? dbGuard();
}

/** "bbca" / "BBCA.JK" → "BBCA.JK"; null bila format tidak valid. */
export function normalizeTicker(input: string): string | null {
    const clean = input.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z]{3,5}(\.JK)?$/.test(clean)) return null;
    return clean.endsWith(".JK") ? clean : `${clean}.JK`;
}

async function ensureOwner(): Promise<string> {
    const owner = await prisma.user.upsert({
        where: { email: OWNER_EMAIL },
        update: {},
        create: { email: OWNER_EMAIL, name: "Owner" },
    });
    return owner.id;
}

async function ensureDefaultWatchlist(userId: string): Promise<string> {
    const list = await prisma.watchlist.upsert({
        where: { userId_name: { userId, name: "Utama" } },
        update: {},
        create: { userId, name: "Utama", isDefault: true },
    });
    return list.id;
}

/** Strategi mengikuti saham aktif — supaya saham baru ikut dievaluasi sinyal. */
async function syncStrategyTickers(): Promise<void> {
    const stocks = await prisma.stock.findMany({ where: { isActive: true }, select: { ticker: true } });
    const tickers = stocks.map((s) => s.ticker);
    await prisma.strategy.updateMany({ data: { stockIds: tickers } });
}

export async function addWatchlistStock(rawTicker: string): Promise<ActionResult> {
    const blocked = guard();
    if (blocked) return blocked;

    const ticker = normalizeTicker(rawTicker);
    if (!ticker) return { ok: false, message: "Format ticker tidak valid. Contoh: BBCA atau BBCA.JK" };

    try {
        const userId = await ensureOwner();
        const stock = await prisma.stock.upsert({
            where: { ticker },
            update: { isActive: true },
            create: { ticker, name: ticker, exchange: "IDX", yahooSymbol: ticker },
        });
        const watchlistId = await ensureDefaultWatchlist(userId);
        await prisma.watchlistItem.upsert({
            where: { watchlistId_stockId: { watchlistId, stockId: stock.id } },
            update: {},
            create: { watchlistId, stockId: stock.id },
        });
        await syncStrategyTickers();
        return { ok: true, message: `${ticker} ditambahkan. Data harga akan tersinkron di siklus worker berikutnya.` };
    } catch (err) {
        return { ok: false, message: `Gagal menambah ${ticker}: ${(err as Error).message}` };
    }
}

export async function removeWatchlistStock(rawTicker: string): Promise<ActionResult> {
    const blocked = guard();
    if (blocked) return blocked;

    const ticker = normalizeTicker(rawTicker);
    if (!ticker) return { ok: false, message: "Ticker tidak valid." };

    try {
        const stock = await prisma.stock.findUnique({ where: { ticker } });
        if (!stock) return { ok: false, message: `${ticker} tidak ditemukan di database.` };

        await prisma.watchlistItem.deleteMany({ where: { stockId: stock.id } });
        await prisma.stock.update({ where: { id: stock.id }, data: { isActive: false } });
        await syncStrategyTickers();
        return { ok: true, message: `${ticker} dihapus dari watchlist (data historis tetap disimpan).` };
    } catch (err) {
        return { ok: false, message: `Gagal menghapus ${ticker}: ${(err as Error).message}` };
    }
}

export async function updateBotSettings(input: {
    mode?: BotMode;
    status?: BotRunStatus;
    killSwitch?: boolean;
}): Promise<ActionResult> {
    const blocked = guard();
    if (blocked) return blocked;

    if (input.mode === "LIVE") {
        return { ok: false, message: "Mode LIVE belum tersedia — integrasi broker menyusul di Fase 3." };
    }

    try {
        const existing = await prisma.botConfig.findFirst();
        const data = {
            ...(input.mode ? { mode: input.mode } : {}),
            ...(input.status ? { status: input.status } : {}),
            ...(input.killSwitch != null ? { killSwitch: input.killSwitch } : {}),
        };

        if (existing) {
            await prisma.botConfig.update({ where: { id: existing.id }, data });
        } else {
            await prisma.botConfig.create({ data: { mode: input.mode ?? "SIGNAL_ONLY", status: input.status ?? "STOPPED", killSwitch: input.killSwitch ?? false } });
        }

        // Sinkronkan mode strategi dengan mode global supaya eksekusi paper
        // trading (trade engine) ikut aktif/mati bersamaan.
        let syncedStrategies = 0;
        if (input.mode === "SIGNAL_ONLY" || input.mode === "PAPER") {
            const result = await prisma.strategy.updateMany({ data: { mode: input.mode } });
            syncedStrategies = result.count;
        }

        const label = [
            input.mode ? `mode ${input.mode}` : null,
            input.status ? `status ${input.status}` : null,
            input.killSwitch != null ? `kill switch ${input.killSwitch ? "AKTIF" : "nonaktif"}` : null,
            syncedStrategies > 0 ? `${syncedStrategies} strategi disinkronkan` : null,
        ]
            .filter(Boolean)
            .join(" · ");
        return { ok: true, message: `Pengaturan bot diperbarui (${label}).` };
    } catch (err) {
        return { ok: false, message: `Gagal menyimpan pengaturan: ${(err as Error).message}` };
    }
}

export async function updateRiskParams(input: RiskParamsInput): Promise<ActionResult> {
    const blocked = guard();
    if (blocked) return blocked;

    const values = Object.values(input);
    if (values.some((v) => !Number.isFinite(v) || v <= 0)) {
        return { ok: false, message: "Semua nilai risk harus angka positif." };
    }

    try {
        const result = await prisma.strategy.updateMany({
            data: { riskParamsJson: JSON.parse(JSON.stringify(input)) },
        });
        return {
            ok: true,
            message: result.count > 0
                ? `Risk params diterapkan ke ${result.count} strategi.`
                : "Belum ada strategi di database — jalankan `npm run db:seed` dulu.",
        };
    } catch (err) {
        return { ok: false, message: `Gagal menyimpan risk params: ${(err as Error).message}` };
    }
}
