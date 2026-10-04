import { describe, it, expect } from "vitest";
import {
    aggregateBrokers,
    brokerConcentration,
    buildForeignFlowSeries,
    detectNetBuyStreak,
    foreignFlowTrend,
    marketBalance,
    sumForeignNet,
    topNetBuyers,
    topNetSellers,
    type BrokerRow,
    type ForeignFlowPoint,
    type InvestorType,
} from "../src/broker";

function row(
    date: string,
    brokerCode: string,
    buyValue: number,
    sellValue: number,
    investorType: InvestorType = "LOCAL",
): BrokerRow {
    return {
        date,
        brokerCode,
        investorType,
        buyFreq: 1,
        buyVolume: buyValue / 100,
        buyValue,
        sellFreq: 1,
        sellVolume: sellValue / 100,
        sellValue,
    };
}

describe("aggregateBrokers", () => {
    it("menjumlahkan baris per broker dan menghitung net", () => {
        const rows = [row("2024-01-01", "AK", 1_000, 400), row("2024-01-02", "AK", 500, 100)];
        const [agg] = aggregateBrokers(rows);

        expect(agg!.brokerCode).toBe("AK");
        expect(agg!.buyValue).toBe(1_500);
        expect(agg!.sellValue).toBe(500);
        expect(agg!.netValue).toBe(1_000);
        expect(agg!.grossValue).toBe(2_000);
        expect(agg!.days).toBe(2);
    });

    it("mengurutkan hasil dari net value terbesar", () => {
        const rows = [row("2024-01-01", "AK", 100, 900), row("2024-01-01", "BK", 900, 100)];
        const result = aggregateBrokers(rows);
        expect(result.map((b) => b.brokerCode)).toEqual(["BK", "AK"]);
    });
});

describe("topNetBuyers / topNetSellers", () => {
    const rows = [
        row("2024-01-01", "BUY1", 1_000, 100),
        row("2024-01-01", "BUY2", 800, 100),
        row("2024-01-01", "SELL1", 100, 1_000),
        row("2024-01-01", "FLAT", 500, 500),
    ];
    const aggregates = aggregateBrokers(rows);

    it("hanya mengembalikan broker net positif untuk buyer", () => {
        expect(topNetBuyers(aggregates).map((b) => b.brokerCode)).toEqual(["BUY1", "BUY2"]);
    });

    it("hanya mengembalikan broker net negatif untuk seller", () => {
        expect(topNetSellers(aggregates).map((b) => b.brokerCode)).toEqual(["SELL1"]);
    });

    it("menghormati batas limit", () => {
        expect(topNetBuyers(aggregates, 1).map((b) => b.brokerCode)).toEqual(["BUY1"]);
    });
});

describe("marketBalance", () => {
    it("memisahkan net asing dan lokal", () => {
        const rows = [
            row("2024-01-01", "AK", 1_000, 200, "FOREIGN"),
            row("2024-01-01", "BK", 300, 600, "LOCAL"),
        ];
        const balance = marketBalance(rows);

        expect(balance.totalBuyValue).toBe(1_300);
        expect(balance.totalSellValue).toBe(800);
        expect(balance.netValue).toBe(500);
        expect(balance.foreignNetValue).toBe(800);
        expect(balance.localNetValue).toBe(-300);
    });
});

describe("brokerConcentration", () => {
    it("HHI = 1 saat hanya satu broker", () => {
        const aggregates = aggregateBrokers([row("2024-01-01", "AK", 1_000, 0)]);
        expect(brokerConcentration(aggregates).hhi).toBeCloseTo(1);
    });

    it("topShare menghitung pangsa broker terbesar", () => {
        const rows = [
            row("2024-01-01", "AK", 800, 0),
            row("2024-01-01", "BK", 100, 0),
            row("2024-01-01", "CK", 100, 0),
        ];
        const { topShare, hhi } = brokerConcentration(aggregateBrokers(rows), 1);
        expect(topShare).toBeCloseTo(0.8);
        expect(hhi).toBeCloseTo(0.66, 2);
    });

    it("aman saat tidak ada data", () => {
        expect(brokerConcentration([])).toEqual({ hhi: 0, topShare: 0, topBrokers: 5 });
    });
});

describe("detectNetBuyStreak", () => {
    it("mendeteksi broker net buy 3 hari berturut-turut", () => {
        const rows = [
            row("2024-01-03", "AK", 1_000, 200),
            row("2024-01-02", "AK", 900, 100),
            row("2024-01-01", "AK", 700, 300),
            row("2024-01-03", "BK", 900, 100),
            row("2024-01-02", "BK", 900, 100),
            row("2024-01-01", "BK", 100, 900),
        ];
        const streaks = detectNetBuyStreak(rows, 3);

        expect(streaks.map((s) => s.brokerCode)).toEqual(["AK"]);
        expect(streaks[0]!.days).toBe(3);
        expect(streaks[0]!.netValue).toBe(2_000);
        expect(streaks[0]!.since).toBe("2024-01-01");
        expect(streaks[0]!.until).toBe("2024-01-03");
    });

    it("berhenti di hari broker tidak net buy", () => {
        const rows = [
            row("2024-01-03", "AK", 1_000, 200),
            row("2024-01-02", "AK", 100, 900),
            row("2024-01-01", "AK", 700, 300),
        ];
        expect(detectNetBuyStreak(rows, 2)).toEqual([]);
    });

    it("mengabaikan data yang lebih pendek dari minDays", () => {
        expect(detectNetBuyStreak([row("2024-01-01", "AK", 100, 50)], 3)).toEqual([]);
    });
});

describe("buildForeignFlowSeries", () => {
    it("menghitung net kumulatif berurutan", () => {
        const points: ForeignFlowPoint[] = [
            { date: "2024-01-01", foreignBuy: 100, foreignSell: 40 },
            { date: "2024-01-02", foreignBuy: 50, foreignSell: 90 },
            { date: "2024-01-03", foreignBuy: 80, foreignSell: 30 },
        ];
        const series = buildForeignFlowSeries(points);

        expect(series.map((p) => p.net)).toEqual([60, -40, 50]);
        expect(series.map((p) => p.cumulative)).toEqual([60, 20, 70]);
    });
});

describe("sumForeignNet", () => {
    const points: ForeignFlowPoint[] = [
        { date: "2024-01-01", foreignBuy: 100, foreignSell: 0 },
        { date: "2024-01-02", foreignBuy: 100, foreignSell: 0 },
        { date: "2024-01-03", foreignBuy: 0, foreignSell: 100 },
    ];

    it("menjumlahkan jendela terakhir", () => {
        expect(sumForeignNet(points, 2)).toBe(0);
        expect(sumForeignNet(points, 3)).toBe(100);
    });

    it("aman untuk window tidak valid", () => {
        expect(sumForeignNet(points, 0)).toBe(0);
    });
});

describe("foreignFlowTrend", () => {
    it("ACCUMULATION saat net jangka pendek positif dan membaik", () => {
        const points: ForeignFlowPoint[] = Array.from({ length: 20 }, (_, i) => ({
            date: `2024-01-${String(i + 1).padStart(2, "0")}`,
            foreignBuy: i >= 15 ? 1_000 : 300,
            foreignSell: 100,
        }));
        expect(foreignFlowTrend(points)).toBe("ACCUMULATION");
    });

    it("DISTRIBUTION saat net jangka pendek negatif dan memburuk", () => {
        const points: ForeignFlowPoint[] = Array.from({ length: 20 }, (_, i) => ({
            date: `2024-01-${String(i + 1).padStart(2, "0")}`,
            foreignBuy: 100,
            foreignSell: i >= 15 ? 1_000 : 300,
        }));
        expect(foreignFlowTrend(points)).toBe("DISTRIBUTION");
    });

    it("NEUTRAL saat tidak ada data", () => {
        expect(foreignFlowTrend([])).toBe("NEUTRAL");
    });
});
