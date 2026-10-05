"use server";

/**
 * Server actions untuk UI (dipanggil dari client component).
 * Implementasinya ada di `lib/mutations.ts`; di sini hanya membungkus
 * dengan revalidasi cache halaman terkait.
 */

import { revalidatePath } from "next/cache";
import {
    addWatchlistStock,
    removeWatchlistStock,
    updateBotSettings,
    updateRiskParams,
    type ActionResult,
    type BotMode,
    type BotRunStatus,
    type RiskParamsInput,
} from "@/lib/mutations";

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
