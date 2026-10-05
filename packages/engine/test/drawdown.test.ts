import { describe, expect, it } from "vitest";
import { drawdownStats } from "../src/stats";

describe("drawdownStats", () => {
    it("mengembalikan null untuk seri kosong", () => {
        expect(drawdownStats([])).toBeNull();
    });

    it("menghitung drawdown maksimum, drawdown saat ini, dan puncak", () => {
        const stats = drawdownStats([10_000_000, 11_000_000, 9_900_000, 10_500_000, 10_000_000]);
        expect(stats).not.toBeNull();
        if (!stats) return;

        // Puncak 11jt → terendah 9,9jt = drawdown -10%.
        expect(stats.maxDrawdownPct).toBeCloseTo(-10, 6);
        // Nilai terakhir 10jt terhadap puncak 11jt = -9.0909%.
        expect(stats.currentDrawdownPct).toBeCloseTo(((10_000_000 - 11_000_000) / 11_000_000) * 100, 6);
        expect(stats.peak).toBe(11_000_000);
        expect(stats.current).toBe(10_000_000);
    });

    it("nol saat seri naik monoton", () => {
        const stats = drawdownStats([100, 200, 300]);
        expect(stats!.maxDrawdownPct).toBe(0);
        expect(stats!.currentDrawdownPct).toBe(0);
        expect(stats!.peak).toBe(300);
    });

    it("drawdown saat ini nol saat nilai terakhir adalah puncak", () => {
        const stats = drawdownStats([100, 80, 120]);
        expect(stats!.maxDrawdownPct).toBeCloseTo(-20, 6);
        expect(stats!.currentDrawdownPct).toBe(0);
    });
});
