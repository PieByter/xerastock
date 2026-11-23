import { describe, expect, it } from "vitest";
import { SectorsBrokerProvider } from "../src/services/brokerData";
import { normalizeIdxCalendar } from "../src/services/corporateActionData";
import { normalizePercent, toNumberOrNull } from "../src/services/fundamentalsData";

describe("SectorsBrokerProvider", () => {
    const payload = {
        data: [
            {
                date: "2026-11-20",
                summary: [
                    {
                        broker_code: "AK",
                        bfreq: 10,
                        blot: 1500,
                        bval: 1_000_000_000,
                        sfreq: 4,
                        slot: 500,
                        sval: 300_000_000,
                        f_bval: 700_000_000,
                        f_sval: 100_000_000,
                    },
                    {
                        broker_code: "YP",
                        bfreq: 3,
                        blot: 200,
                        bval: 100_000_000,
                        sfreq: 2,
                        slot: 300,
                        sval: 250_000_000,
                    },
                ],
            },
        ],
    };

    const fetchImpl = (async () =>
        new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "content-type": "application/json" },
        })) as typeof fetch;

    it("memetakan broker summary dan konversi lot ke lembar", async () => {
        const provider = new SectorsBrokerProvider({ apiKey: "test", fetchImpl });
        const summary = await provider.getBrokerSummary("BBCA.JK", "2026-11-20");

        expect(summary?.source).toBe("sectors");
        expect(summary?.rows).toHaveLength(2);
        expect(summary?.rows[0]).toMatchObject({
            brokerCode: "AK",
            investorType: "FOREIGN",
            buyVolume: 150_000,
            sellVolume: 50_000,
            buyValue: 1_000_000_000,
        });
        expect(summary?.rows[1]?.investorType).toBe("LOCAL");
    });

    it("menghitung foreign flow dari field f_bval/f_sval", async () => {
        const provider = new SectorsBrokerProvider({ apiKey: "test", fetchImpl });
        const flow = await provider.getForeignFlow("BBCA.JK", "2026-11-20", "2026-11-20");

        expect(flow).toEqual([
            { date: "2026-11-20", foreignBuy: 700_000_000, foreignSell: 100_000_000 },
        ]);
    });

    it("memakai header Authorization berisi API key", async () => {
        let authorization = "";
        const capture = (async (_input: RequestInfo | URL, init?: RequestInit) => {
            authorization = String((init?.headers as Record<string, string> | undefined)?.authorization ?? "");
            return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }) as typeof fetch;

        const provider = new SectorsBrokerProvider({ apiKey: "rahasia", fetchImpl: capture });
        await provider.getBrokerSummary("BBCA", "2026-11-20");
        expect(authorization).toBe("rahasia");
    });
});

describe("normalizeIdxCalendar", () => {
    it("menggabungkan milestone cum/ex/payment menjadi satu aksi korporasi", () => {
        const items = normalizeIdxCalendar(
            [
                { title: "BBCA", description: "tanggal cum Dividen Tunai", start: "2026-11-25T00:00:00" },
                { title: "BBCA", description: "tanggal ex Dividen Tunai", start: "2026-11-26T00:00:00" },
                { title: "BBCA", description: "tanggal pembayaran Dividen Tunai", start: "2026-12-05T00:00:00" },
                { title: "TLKM", description: "tanggal cum Dividen Tunai", start: "2026-11-25T00:00:00" },
                { title: "BBCA", description: "Pemberitahuan RUPS Tahunan", start: "2026-12-10T00:00:00" },
            ],
            "BBCA.JK",
        );

        expect(items).toHaveLength(2);
        const dividend = items.find((item) => item.type === "DIVIDEND")!;
        expect(dividend.ticker).toBe("BBCA");
        expect(dividend.cumDate.toISOString().slice(0, 10)).toBe("2026-11-25");
        expect(dividend.exDate.toISOString().slice(0, 10)).toBe("2026-11-26");
        expect(dividend.paymentDate?.toISOString().slice(0, 10)).toBe("2026-12-05");

        const rups = items.find((item) => item.type === "RUPS")!;
        expect(rups.cumDate.toISOString().slice(0, 10)).toBe("2026-12-10");
    });

    it("mengabaikan event milik ticker lain dan event non-corporate", () => {
        const items = normalizeIdxCalendar(
            [
                { title: "BBRI", description: "tanggal cum Dividen", start: "2026-11-25T00:00:00" },
                { title: "BBCA", description: "Informasi Pembayaran Kupon", start: "2026-11-25T00:00:00" },
            ],
            "BBCA",
        );
        expect(items).toHaveLength(0);
    });
});

describe("fundamental helpers", () => {
    it("membaca { raw } dan string angka dari Yahoo", () => {
        expect(toNumberOrNull(12.5)).toBe(12.5);
        expect(toNumberOrNull({ raw: 8.25 })).toBe(8.25);
        expect(toNumberOrNull("3.5")).toBe(3.5);
        expect(toNumberOrNull(null)).toBeNull();
    });

    it("menormalkan ROE fraksi ke persen", () => {
        expect(normalizePercent(0.18)).toBe(18);
        expect(normalizePercent(18)).toBe(18);
        expect(normalizePercent(null)).toBeNull();
    });
});
