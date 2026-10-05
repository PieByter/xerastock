/**
 * Screener (PRD FR-FUND-002/FR-FUND-004) — jalankan filter terhadap seluruh
 * saham aktif langsung dari DB. Dipakai command /screener Discord dan memakai
 * matcher engine yang sama dengan UI web supaya hasilnya konsisten.
 */

import type { PrismaClient } from "@stock-analyst/db";
import { lastNonNull, matchesScreenerFilters, rsi, type ScreenerRow } from "@stock-analyst/engine";
import type { ScreenerFilter } from "@stock-analyst/shared";

export interface ScreenerResultRow extends ScreenerRow {
    ticker: string;
    name: string;
    price: number;
    changePct: number;
}

export interface ScreenerOutcome {
    rows: ScreenerResultRow[];
    /** Jumlah saham aktif yang dievaluasi. */
    scanned: number;
}

/** Susun baris screener dari DB (harga, RSI, fundamental) lalu terapkan filter. */
export async function runScreener(
    prisma: PrismaClient,
    filters: ScreenerFilter[],
): Promise<ScreenerOutcome> {
    const stocks = await prisma.stock.findMany({
        where: { isActive: true },
        orderBy: { ticker: "asc" },
        take: 100,
        include: {
            priceBars: { orderBy: { timestamp: "desc" }, take: 60 },
            fundamentalSnapshots: { orderBy: { asOfDate: "desc" }, take: 1 },
        },
    });

    const rows: ScreenerResultRow[] = [];
    for (const stock of stocks) {
        if (stock.priceBars.length < 2) continue;

        const bars = [...stock.priceBars].reverse();
        const closes = bars.map((b) => Number(b.close));
        const last = bars[bars.length - 1]!;
        const prev = bars[bars.length - 2]!;
        const fundamental = stock.fundamentalSnapshots[0];

        const row: ScreenerResultRow = {
            ticker: stock.ticker,
            name: stock.name,
            price: Number(last.close),
            changePct:
                Number(prev.close) > 0
                    ? ((Number(last.close) - Number(prev.close)) / Number(prev.close)) * 100
                    : 0,
            per: Number(fundamental?.per ?? 0),
            pbv: Number(fundamental?.pbv ?? 0),
            roe: Number(fundamental?.roe ?? 0),
            divYield: Number(fundamental?.divYield ?? 0),
            rsi14: lastNonNull(rsi(closes, 14)) ?? 50,
            marketCap: fundamental?.marketCap != null ? Number(fundamental.marketCap) : 0,
        };

        if (matchesScreenerFilters(row, filters)) rows.push(row);
    }

    return { rows, scanned: stocks.length };
}
