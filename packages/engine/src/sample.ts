/**
 * Data contoh broker summary & foreign flow.
 *
 * Murni & deterministik (tanpa I/O) supaya bisa dipakai bersama oleh:
 * - web dashboard sebagai fallback demo saat DB belum terisi (PRD 10.3), dan
 * - worker sebagai provider `sample` saat endpoint broker belum dikonfigurasi.
 *
 * Analitiknya sendiri tetap dihitung modul broker.ts / foreignFlow.ts.
 */

import type { BrokerRow, ForeignFlowPoint, InvestorType } from "./broker";

export interface SampleBroker {
    code: string;
    investorType: InvestorType;
}

/** Kode broker IDX yang umum muncul di tabel broker summary. */
export const SAMPLE_BROKERS: SampleBroker[] = [
    { code: "AK", investorType: "FOREIGN" },
    { code: "BK", investorType: "FOREIGN" },
    { code: "CS", investorType: "FOREIGN" },
    { code: "KZ", investorType: "FOREIGN" },
    { code: "RX", investorType: "FOREIGN" },
    { code: "DX", investorType: "LOCAL" },
    { code: "MG", investorType: "LOCAL" },
    { code: "NI", investorType: "LOCAL" },
    { code: "OD", investorType: "LOCAL" },
    { code: "YP", investorType: "LOCAL" },
];

/**
 * Bias beli/jual tetap per broker (diulang mengikuti daftar broker) supaya setiap
 * hari bursa selalu ada broker di sisi akumulasi maupun distribusi.
 */
export const SAMPLE_BROKER_BIASES = [-0.26, -0.13, 0, 0.13, 0.26];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface SampleBrokerOptions {
    /** Daftar tanggal bursa yang dicakup (urut lama → baru). */
    dates: string[];
    /** Perkiraan nilai transaksi harian (Rp) untuk skala angka. */
    dailyTurnover: number;
    /** Harga acuan untuk konversi nilai → volume. */
    avgPrice: number;
    seed?: number;
}

/**
 * Broker summary sintetis untuk demo mode.
 *
 * Dipatok ke daftar tanggal candle supaya tabel broker sejajar dengan chart.
 * Beberapa hal sengaja dibuat deterministik supaya fitur analitik ikut terlihat:
 * tiap broker punya bias tetap (ada sisi akumulasi & distribusi setiap hari),
 * broker asing dengan bias positif menaikkan porsi beli di 10 hari terakhir
 * (tren akumulasi asing), dan broker pertama net buy di 4 hari terakhir
 * (highlight streak).
 */
export function generateSampleBrokerRows(options: SampleBrokerOptions): BrokerRow[] {
    const { dates, dailyTurnover, avgPrice, seed = 1 } = options;
    const out: BrokerRow[] = [];
    if (dates.length === 0) return out;

    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    const rand = () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };

    const turnover = Math.max(dailyTurnover, 5_000_000_000);
    const price = Math.max(avgPrice, 1);
    const lastIndex = dates.length - 1;

    SAMPLE_BROKERS.forEach((broker, brokerIndex) => {
        const share = (broker.investorType === "FOREIGN" ? 0.07 : 0.12) * (0.6 + rand() * 0.9);
        const bias = SAMPLE_BROKER_BIASES[brokerIndex % SAMPLE_BROKER_BIASES.length] ?? 0;
        const accumulating = broker.investorType === "FOREIGN" && bias > 0;

        dates.forEach((date, dateIndex) => {
            const recentBoost = accumulating && dateIndex >= lastIndex - 9 ? 0.1 : 0;
            const gross = turnover * share * (0.5 + rand() * 1.2);
            const forceBuy = brokerIndex === 0 && dateIndex >= lastIndex - 3;
            const buyRatio = forceBuy
                ? 0.75
                : clamp(0.5 + bias + (rand() - 0.5) * 0.16 + recentBoost, 0.08, 0.92);

            const buyValue = Math.round(gross * buyRatio);
            const sellValue = Math.round(gross - buyValue);

            out.push({
                date,
                brokerCode: broker.code,
                investorType: broker.investorType,
                buyFreq: 20 + Math.round(rand() * 400),
                buyVolume: Math.round(buyValue / price),
                buyValue,
                sellFreq: 20 + Math.round(rand() * 400),
                sellVolume: Math.round(sellValue / price),
                sellValue,
            });
        });
    });

    return out;
}

/**
 * Foreign flow harian dari baris broker asing — satu sumber angka dengan tabel
 * broker supaya chart net foreign flow tidak bertentangan dengan tabelnya.
 */
export function sumForeignFlow(rows: BrokerRow[]): ForeignFlowPoint[] {
    const byDate = new Map<string, { foreignBuy: number; foreignSell: number }>();

    for (const row of rows) {
        if (row.investorType !== "FOREIGN") continue;
        const entry = byDate.get(row.date) ?? { foreignBuy: 0, foreignSell: 0 };
        entry.foreignBuy += row.buyValue;
        entry.foreignSell += row.sellValue;
        byDate.set(row.date, entry);
    }

    return [...byDate.entries()]
        .map(([date, value]) => ({ date, ...value }))
        .sort((a, b) => a.date.localeCompare(b.date));
}
