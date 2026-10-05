/**
 * Seed data awal yang idempoten (aman dipanggil setiap worker start):
 * user owner, master saham watchlist default, dan 3 strategi sinyal
 * (BSJP / BPJS / SWING) berisi rule default — tanpa ini tabel `Strategy`
 * kosong dan evaluator sinyal tidak pernah menghasilkan apa pun.
 */

import type { PrismaClient } from "@stock-analyst/db";
import { Prisma } from "@stock-analyst/db";
import {
    DEFAULT_RISK_PARAMS,
    DEFAULT_STRATEGY_RULES,
    DEFAULT_WATCHLIST_TICKERS,
    STRATEGY_CONFIG,
    type StrategyType,
} from "@stock-analyst/shared";
import { logger } from "../logger";

export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@xerastock.local";

/** Pastikan user owner ada (single-user) dan kembalikan id-nya. */
export async function ensureOwner(prisma: PrismaClient): Promise<string> {
    const owner = await prisma.user.upsert({
        where: { email: OWNER_EMAIL },
        update: {},
        create: { email: OWNER_EMAIL, name: "Owner" },
    });
    return owner.id;
}

/** Pastikan master saham untuk daftar ticker ada; kembalikan id per ticker. */
export async function ensureStocks(prisma: PrismaClient, tickers: readonly string[]) {
    const stocks = [];
    for (const ticker of tickers) {
        stocks.push(
            await prisma.stock.upsert({
                where: { ticker },
                update: {},
                create: { ticker, name: ticker, exchange: "IDX", yahooSymbol: ticker },
            }),
        );
    }
    return stocks;
}

/**
 * Seed 3 strategi default. Strategi yang sudah ada hanya disinkronkan
 * daftar ticker-nya supaya saham baru ikut dievaluasi.
 */
export async function ensureStrategies(prisma: PrismaClient, userId: string, tickers: string[]) {
    let created = 0;
    for (const type of Object.keys(DEFAULT_STRATEGY_RULES) as StrategyType[]) {
        const existing = await prisma.strategy.findFirst({
            where: { userId, strategyType: type },
        });

        if (existing) {
            const missing = tickers.filter((t) => !existing.stockIds.includes(t));
            if (missing.length > 0) {
                await prisma.strategy.update({
                    where: { id: existing.id },
                    data: { stockIds: [...existing.stockIds, ...missing] },
                });
            }
            continue;
        }

        const rules = DEFAULT_STRATEGY_RULES[type];
        await prisma.strategy.create({
            data: {
                userId,
                name: STRATEGY_CONFIG[type].name,
                strategyType: type,
                stockIds: tickers,
                entryRulesJson: rules.entry as unknown as Prisma.InputJsonValue,
                exitRulesJson: rules.exit as unknown as Prisma.InputJsonValue,
                riskParamsJson: DEFAULT_RISK_PARAMS,
                mode: "SIGNAL_ONLY",
                isActive: true,
            },
        });
        created++;
    }
    return created;
}

/** Seed lengkap: owner → watchlist default → saham → strategi. */
export async function ensureSeedData(prisma: PrismaClient): Promise<void> {
    const userId = await ensureOwner(prisma);
    const tickers = [...DEFAULT_WATCHLIST_TICKERS];
    const stocks = await ensureStocks(prisma, tickers);

    const defaultList = await prisma.watchlist.upsert({
        where: { userId_name: { userId, name: "Utama" } },
        update: {},
        create: { userId, name: "Utama", isDefault: true },
    });

    for (const stock of stocks) {
        await prisma.watchlistItem.upsert({
            where: { watchlistId_stockId: { watchlistId: defaultList.id, stockId: stock.id } },
            update: {},
            create: { watchlistId: defaultList.id, stockId: stock.id },
        });
    }

    const created = await ensureStrategies(prisma, userId, tickers);
    logger.info({ stocks: stocks.length, strategiesCreated: created }, "seed data awal OK");
}
