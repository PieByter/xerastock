import { describe, expect, it } from "vitest";
import type { ScreenerFilter } from "@stock-analyst/shared";
import { matchesScreenerFilters, type ScreenerRow } from "../src/screener";

const row: ScreenerRow = { per: 12, pbv: 1.2, roe: 18, divYield: 3.5, rsi14: 55 };

describe("matchesScreenerFilters", () => {
    it("lolos saat semua kondisi terpenuhi", () => {
        const filters: ScreenerFilter[] = [
            { field: "per", operator: "lt", value: 15 },
            { field: "pbv", operator: "lt", value: 2 },
            { field: "roe", operator: "gt", value: 15 },
            { field: "rsi14", operator: "between", value: [30, 70] },
        ];
        expect(matchesScreenerFilters(row, filters)).toBe(true);
    });

    it("menolak saat salah satu filter tidak terpenuhi", () => {
        expect(matchesScreenerFilters(row, [{ field: "roe", operator: "gt", value: 20 }])).toBe(false);
        expect(matchesScreenerFilters(row, [])).toBe(true);
    });

    it("nilai fundamental 0 (tidak tersedia) tidak pernah lolos filter", () => {
        const missing: ScreenerRow = { ...row, per: 0, pbv: 0, roe: 0, divYield: 0 };
        expect(matchesScreenerFilters(missing, [{ field: "per", operator: "lt", value: 15 }])).toBe(false);
        expect(matchesScreenerFilters(missing, [{ field: "roe", operator: "lt", value: 5 }])).toBe(false);
        expect(matchesScreenerFilters(missing, [{ field: "divYield", operator: "gt", value: 1 }])).toBe(false);
    });

    it("mendukung RSI lt / gt / between", () => {
        expect(matchesScreenerFilters({ ...row, rsi14: 25 }, [{ field: "rsi14", operator: "lt", value: 30 }])).toBe(true);
        expect(matchesScreenerFilters({ ...row, rsi14: 80 }, [{ field: "rsi14", operator: "gt", value: 70 }])).toBe(true);
        expect(
            matchesScreenerFilters({ ...row, rsi14: 80 }, [{ field: "rsi14", operator: "between", value: [30, 70] }]),
        ).toBe(false);
        expect(
            matchesScreenerFilters({ ...row, rsi14: 70 }, [{ field: "rsi14", operator: "between", value: [30, 70] }]),
        ).toBe(true);
    });
});
