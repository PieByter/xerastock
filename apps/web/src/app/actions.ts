"use server";

/**
 * Server actions untuk UI (dipanggil dari client component).
 * Implementasinya ada di `lib/mutations.ts`; di sini hanya membungkus
 * dengan revalidasi cache halaman terkait.
 */

import { revalidatePath } from "next/cache";
import type { ScreenerFilter } from "@stock-analyst/shared";
import {
    addWatchlistStock,
    removeWatchlistStock,
    updateBotSettings,
    updateRiskParams,
    saveScreenerPreset,
    deleteScreenerPreset,
    type ActionResult,
    type BotMode,
    type BotRunStatus,
    type RiskParamsInput,
} from "@/lib/mutations";
import { runBacktest, type BacktestInput, type BacktestRunResponse } from "@/lib/backtest";

function revalidateAll() {
    for (const path of ["/", "/watchlist", "/technical", "/bot", "/settings", "/portfolio", "/broker-flow"]) {
        revalidatePath(path);
    }
}

export async function addStockAction(ticker: string): Promise<ActionResult> {
    const result = await addWatchlistStock(ticker);
    if (result.ok) revalidateAll();
    return result;
}

export async function removeStockAction(ticker: string): Promise<ActionResult> {
    const result = await removeWatchlistStock(ticker);
    if (result.ok) revalidateAll();
    return result;
}

export async function updateBotAction(input: {
    mode?: BotMode;
    status?: BotRunStatus;
    killSwitch?: boolean;
}): Promise<ActionResult> {
    const result = await updateBotSettings(input);
    if (result.ok) revalidateAll();
    return result;
}

export async function updateRiskAction(input: RiskParamsInput): Promise<ActionResult> {
    const result = await updateRiskParams(input);
    if (result.ok) revalidateAll();
    return result;
}

/** Hitung backtest (read-only) — tidak ada perubahan data, tanpa revalidasi. */
export async function runBacktestAction(input: BacktestInput): Promise<BacktestRunResponse> {
    return runBacktest(input);
}

export async function saveScreenerPresetAction(
    name: string,
    filters: ScreenerFilter[],
): Promise<ActionResult> {
    const result = await saveScreenerPreset(name, filters);
    if (result.ok) revalidatePath("/screener");
    return result;
}

export async function deleteScreenerPresetAction(id: string): Promise<ActionResult> {
    const result = await deleteScreenerPreset(id);
    if (result.ok) revalidatePath("/screener");
    return result;
}
