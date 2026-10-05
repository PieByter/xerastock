/**
 * Mutasi tulis (server-only) untuk UI: watchlist, pengaturan bot, risk params.
 *
 * Semua fungsi mengembalikan `ActionResult` dan menolak dengan pesan jelas
 * bila `DATABASE_URL` belum di-set (mode demo) — UI tidak pernah crash.
 * Hanya boleh diimpor dari server action / server code.
 */

import { prisma } from "@stock-analyst/db";
import type { ScreenerFilter } from "@stock-analyst/shared";
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

// ---------- Preset screener (FR-FUND-004) ----------

const SCREENER_FIELDS: ScreenerFilter["field"][] = ["per", "pbv", "roe", "marketCap", "divYield", "rsi14", "maCross"];
const SCREENER_OPERATORS: ScreenerFilter["operator"][] = ["gt", "lt", "between"];

/** Validasi & normalisasi filter dari UI sebelum disimpan ke DB. */
function validateScreenerFilters(
    input: unknown,
): { ok: true; filters: ScreenerFilter[] } | { ok: false; message: string } {
    if (!Array.isArray(input)) return { ok: false, message: "Filter harus berupa array." };

    const filters: ScreenerFilter[] = [];
    for (const raw of input) {
        const item = raw as Partial<ScreenerFilter>;
        if (!item || typeof item !== "object") {
            return { ok: false, message: "Filter tidak valid." };
        }
        const field = item.field as ScreenerFilter["field"];
        const operator = item.operator as ScreenerFilter["operator"];
        if (!SCREENER_FIELDS.includes(field)) {
            return { ok: false, message: `Field filter "${String(item.field)}" tidak didukung.` };
        }
        if (!SCREENER_OPERATORS.includes(operator)) {
            return { ok: false, message: `Operator filter "${String(item.operator)}" tidak didukung.` };
        }
        if (operator === "between") {
            const value = item.value;
            if (!Array.isArray(value) || value.length !== 2 || value.some((v) => !Number.isFinite(Number(v)))) {
                return { ok: false, message: "Nilai filter between harus [min, max] berupa angka." };
            }
            filters.push({ field, operator, value: [Number(value[0]), Number(value[1])] });
        } else {
            if (!Number.isFinite(Number(item.value))) {
                return { ok: false, message: "Nilai filter harus angka." };
            }
            filters.push({ field, operator, value: Number(item.value) });
        }
    }
    return { ok: true, filters };
}

/** Simpan (upsert by nama) preset screener milik owner. */
export async function saveScreenerPreset(name: string, filters: unknown): Promise<ActionResult> {
    const blocked = guard();
    if (blocked) return blocked;

    const cleanName = name.trim();
    if (cleanName.length < 1 || cleanName.length > 40) {
        return { ok: false, message: "Nama preset harus 1-40 karakter." };
    }
    const validated = validateScreenerFilters(filters);
    if (!validated.ok) return { ok: false, message: validated.message };

    try {
        const userId = await ensureOwner();
        const filtersJson = JSON.parse(JSON.stringify(validated.filters));
        const preset = await prisma.screenerPreset.upsert({
            where: { userId_name: { userId, name: cleanName } },
            update: { filtersJson },
            create: { userId, name: cleanName, filtersJson },
        });
        return { ok: true, message: `Preset "${preset.name}" disimpan (${validated.filters.length} filter).` };
    } catch (err) {
        return { ok: false, message: `Gagal menyimpan preset: ${(err as Error).message}` };
    }
}

/** Hapus preset screener milik owner. */
export async function deleteScreenerPreset(id: string): Promise<ActionResult> {
    const blocked = guard();
    if (blocked) return blocked;

    if (!id) return { ok: false, message: "ID preset tidak valid." };

    try {
        const userId = await ensureOwner();
        const result = await prisma.screenerPreset.deleteMany({ where: { id, userId } });
        return result.count > 0
            ? { ok: true, message: "Preset dihapus." }
            : { ok: false, message: "Preset tidak ditemukan." };
    } catch (err) {
        return { ok: false, message: `Gagal menghapus preset: ${(err as Error).message}` };
    }
}
