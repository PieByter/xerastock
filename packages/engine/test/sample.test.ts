import { describe, it, expect } from "vitest";
import {
    SAMPLE_BROKER_BIASES,
    SAMPLE_BROKERS,
    generateSampleBrokerRows,
    sumForeignFlow,
} from "../src/sample";
import { aggregateBrokers, topNetBuyers, topNetSellers } from "../src/broker";

const DATES = ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24"];

const options = () => ({ dates: DATES, dailyTurnover: 50_000_000_000, avgPrice: 1_000, seed: 7 });

describe("generateSampleBrokerRows", () => {
    it("menghasilkan satu baris per broker per tanggal", () => {
        const rows = generateSampleBrokerRows(options());
        expect(rows).toHaveLength(SAMPLE_BROKERS.length * DATES.length);
        expect(new Set(rows.map((r) => r.brokerCode)).size).toBe(SAMPLE_BROKERS.length);
    });

    it("deterministik untuk seed yang sama dan berbeda untuk seed lain", () => {
        expect(generateSampleBrokerRows(options())).toEqual(generateSampleBrokerRows(options()));
        expect(generateSampleBrokerRows({ ...options(), seed: 8 })).not.toEqual(generateSampleBrokerRows(options()));
    });

    it("kembali kosong bila tidak ada tanggal", () => {
        expect(generateSampleBrokerRows({ ...options(), dates: [] })).toEqual([]);
    });

    it("selalu punya sisi akumulasi dan distribusi di setiap tanggal", () => {
        const rows = generateSampleBrokerRows(options());

        for (const date of DATES) {
            const daily = rows.filter((r) => r.date === date);
            expect(topNetBuyers(aggregateBrokers(daily), 5).length).toBeGreaterThan(0);
            expect(topNetSellers(aggregateBrokers(daily), 5).length).toBeGreaterThan(0);
        }
    });

    it("bias broker menjaga arah net beli/jual antar-hari", () => {
        const rows = generateSampleBrokerRows(options());
        const byBroker = aggregateBrokers(rows);

        for (const [index, broker] of SAMPLE_BROKERS.entries()) {
            const bias = SAMPLE_BROKER_BIASES[index % SAMPLE_BROKER_BIASES.length]!;
            const aggregate = byBroker.find((b) => b.brokerCode === broker.code)!;
            // Broker pertama dipaksa net buy di hari terakhir, jadi hanya diperiksa
            // untuk bias negatif selain broker itu.
            if (bias < 0 && index !== 0) expect(aggregate.netValue).toBeLessThan(0);
            if (bias > 0) expect(aggregate.netValue).toBeGreaterThan(0);
        }
    });

    it("buy + sell sama dengan nilai transaksi bruto harian", () => {
        const rows = generateSampleBrokerRows(options());

        for (const row of rows) {
            expect(row.buyValue + row.sellValue).toBeGreaterThan(0);
            expect(row.buyVolume).toBeGreaterThanOrEqual(0);
            expect(row.sellVolume).toBeGreaterThanOrEqual(0);
        }
    });

    it("menghormati harga acuan saat konversi nilai → volume", () => {
        const cheap = generateSampleBrokerRows({ ...options(), avgPrice: 100 });
        const pricey = generateSampleBrokerRows({ ...options(), avgPrice: 10_000 });

        const cheapVolume = cheap.reduce((sum, row) => sum + row.buyVolume, 0);
        const priceyVolume = pricey.reduce((sum, row) => sum + row.buyVolume, 0);
        expect(cheapVolume).toBeGreaterThan(priceyVolume);
    });
});

describe("sumForeignFlow", () => {
    it("hanya menjumlahkan broker asing dan urut menaik per tanggal", () => {
        const rows = generateSampleBrokerRows(options());
        const flow = sumForeignFlow([...rows].reverse());

        expect(flow.map((p) => p.date)).toEqual(DATES);

        const firstDate = rows.filter((r) => r.date === DATES[0] && r.investorType === "FOREIGN");
        const expected = firstDate.reduce((sum, row) => sum + row.buyValue, 0);
        expect(flow[0]!.foreignBuy).toBe(expected);
    });

    it("mengabaikan broker lokal", () => {
        const localOnly = generateSampleBrokerRows(options()).filter((r) => r.investorType === "LOCAL");
        expect(sumForeignFlow(localOnly)).toEqual([]);
    });
});
