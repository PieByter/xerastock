/**
 * Screener — evaluasi filter (PRD FR-FUND-002/FR-FUND-004) terhadap baris saham.
 * Fungsi murni supaya UI web dan command /screener Discord memakai semantik
 * pencocokan yang sama.
 */

import type { ScreenerFilter } from "@stock-analyst/shared";

/** Nilai minimum yang dibutuhkan untuk mengevaluasi filter screener. */
export interface ScreenerRow {
    per: number;
    pbv: number;
    roe: number;
    divYield: number;
    rsi14: number;
    marketCap?: number;
}

/**
 * Field fundamental memakai 0 sebagai penanda "tidak tersedia" — nilai 0
 * tidak pernah lolos filter supaya saham tanpa data tidak ikut terpilih.
 */
const REQUIRED_POSITIVE = new Set(["per", "pbv", "roe", "divYield", "marketCap"]);

function fieldValue(row: ScreenerRow, field: ScreenerFilter["field"]): number | null {
    switch (field) {
        case "per":
            return row.per;
        case "pbv":
            return row.pbv;
        case "roe":
            return row.roe;
        case "divYield":
            return row.divYield;
        case "rsi14":
            return row.rsi14;
        case "marketCap":
            return row.marketCap ?? 0;
        default:
            return null;
    }
}

/** true bila baris lolos SEMUA filter. Filter tanpa nilai valid → tidak lolos. */
export function matchesScreenerFilters(row: ScreenerRow, filters: ScreenerFilter[]): boolean {
    return filters.every((filter) => {
        const value = fieldValue(row, filter.field);
        if (value == null || !Number.isFinite(value)) return false;
        if (REQUIRED_POSITIVE.has(filter.field) && value <= 0) return false;

        if (filter.operator === "lt") return value < Number(filter.value);
        if (filter.operator === "gt") return value > Number(filter.value);

        if (!Array.isArray(filter.value)) return false;
        const [min, max] = filter.value;
        return value >= min && value <= max;
    });
}
