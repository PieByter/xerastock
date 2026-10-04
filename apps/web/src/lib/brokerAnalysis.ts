/**
 * Pembentuk bagian "analisis mendalam" untuk halaman saham (PRD 4.2/4.3).
 *
 * Modul ini tidak menyentuh database: ia menerima baris broker / titik foreign
 * flow / candle apa adanya, lalu merapikannya jadi bentuk siap-render memakai
 * fungsi analitik di `@stock-analyst/engine`. Dengan begitu perhitungan yang
 * sama dipakai untuk data asli maupun data contoh.
 */

import {
    aggregateBrokers,
    brokerConcentration,
    buildForeignFlowSeries,
    detectNetBuyStreak,
    foreignFlowTrend,
    keyStats,
    marketBalance,
    supportResistance,
    sumForeignNet,
    topNetBuyers,
    topNetSellers,
    type BrokerRow,
    type Candle,
    type FlowTrend,
    type ForeignFlowPoint,
    type InvestorType,
} from "@stock-analyst/engine";

// ---------- Periode tabel broker ----------

export type BrokerPeriodKey = "1d" | "5d" | "20d";

export const BROKER_PERIODS: { key: BrokerPeriodKey; label: string; days: number }[] = [
    { key: "1d", label: "Hari terakhir", days: 1 },
    { key: "5d", label: "5 hari", days: 5 },
    { key: "20d", label: "20 hari", days: 20 },
];

export function resolveBrokerPeriod(value: string | string[] | undefined): BrokerPeriodKey {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw === "1d" || raw === "5d" || raw === "20d" ? raw : "1d";
}

// ---------- Tabel broker ----------

export interface BrokerTableRow {
    brokerCode: string;
    investorType: InvestorType;
    buyValue: number;
    sellValue: number;
    netValue: number;
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
    grossValue: number;
    /** Jumlah hari bursa broker muncul di dalam periode. */
    days: number;
    /** Porsi net terhadap total gross broker (untuk lebar bar). */
    barRatio: number;
}

export interface BrokerStreakView {
    brokerCode: string;
    investorType: InvestorType;
    days: number;
    netValue: number;
    since: string;
    until: string;
}

export interface BrokerSummaryView {
    period: BrokerPeriodKey;
    periodLabel: string;
    /** Tanggal bursa terakhir yang punya data. */
    date: string;
    /** Jumlah hari bursa tercakup di periode terpilih. */
    tradingDays: number;
    totalBrokers: number;
    balance: {
        totalBuyValue: number;
        totalSellValue: number;
        netValue: number;
        foreignNetValue: number;
        localNetValue: number;
    };
    buyers: BrokerTableRow[];
    sellers: BrokerTableRow[];
    concentration: {
        hhi: number;
        topShare: number;
        topBrokers: number;
        /** 0..1 — dipakai untuk meter konsentrasi di UI. */
        meterRatio: number;
    };
    streaks: BrokerStreakView[];
}

/** Lebar bar relatif terhadap net absolut terbesar di daftar yang sama. */
function toTableRow(row: ReturnType<typeof aggregateBrokers>[number], maxAbsNet: number): BrokerTableRow {
    return {
        brokerCode: row.brokerCode,
        investorType: row.investorType,
        buyValue: row.buyValue,
        sellValue: row.sellValue,
        netValue: row.netValue,
        buyVolume: row.buyVolume,
        sellVolume: row.sellVolume,
        netVolume: row.netVolume,
        grossValue: row.grossValue,
        days: row.days,
        barRatio: maxAbsNet > 0 ? Math.min(Math.abs(row.netValue) / maxAbsNet, 1) : 0,
    };
}

/**
 * Rangkum broker summary untuk periode terpilih.
 * `rows` sebaiknya berisi riwayat beberapa minggu supaya streak terdeteksi,
 * meskipun tabelnya hanya menampilkan periode terpilih.
 */
export function buildBrokerSummary(rows: BrokerRow[], period: BrokerPeriodKey): BrokerSummaryView | null {
    if (rows.length === 0) return null;

    const allDates = [...new Set(rows.map((r) => r.date))].sort().reverse();
    const periodConfig = BROKER_PERIODS.find((p) => p.key === period) ?? BROKER_PERIODS[0]!;
    const windowDates = new Set(allDates.slice(0, periodConfig.days));

    const windowRows = rows.filter((r) => windowDates.has(r.date));
    if (windowRows.length === 0) return null;

    const aggregates = aggregateBrokers(windowRows);
    const buyers = topNetBuyers(aggregates, 5);
    const sellers = topNetSellers(aggregates, 5);
    const maxBuyerNet = Math.max(0, ...buyers.map((b) => b.netValue));
    const maxSellerNet = Math.max(0, ...sellers.map((s) => Math.abs(s.netValue)));

    const balance = marketBalance(windowRows);
    const concentration = brokerConcentration(aggregates);

    return {
        period,
        periodLabel: periodConfig.label,
        date: allDates[0]!,
        tradingDays: windowDates.size,
        totalBrokers: aggregates.length,
        balance: {
            totalBuyValue: balance.totalBuyValue,
            totalSellValue: balance.totalSellValue,
            netValue: balance.netValue,
            foreignNetValue: balance.foreignNetValue,
            localNetValue: balance.localNetValue,
        },
        buyers: buyers.map((b) => toTableRow(b, maxBuyerNet)),
        sellers: sellers.map((s) => toTableRow(s, maxSellerNet)),
        concentration: {
            ...concentration,
            meterRatio: Math.min(concentration.topShare, 1),
        },
        streaks: detectNetBuyStreak(rows, 3).slice(0, 4),
    };
}

// ---------- Foreign flow ----------

export interface ForeignFlowPointView {
    date: string;
    foreignBuy: number;
    foreignSell: number;
    net: number;
    cumulative: number;
}

export interface ForeignFlowView {
    trend: FlowTrend;
    net5d: number;
    net20d: number;
    netLatest: number;
    cumulativeNet: number;
    totalBuy: number;
    totalSell: number;
    tradingDays: number;
    points: ForeignFlowPointView[];
}

/** Deret net foreign flow + net kumulatif (PRD 4.3: grafik akumulasi/distribusi). */
export function buildForeignFlow(points: ForeignFlowPoint[]): ForeignFlowView | null {
    if (points.length === 0) return null;

    const series = buildForeignFlowSeries(points);
    const totalBuy = series.reduce((sum, p) => sum + p.foreignBuy, 0);
    const totalSell = series.reduce((sum, p) => sum + p.foreignSell, 0);
    const latest = series[series.length - 1]!;

    return {
        trend: foreignFlowTrend(points),
        net5d: sumForeignNet(points, 5),
        net20d: sumForeignNet(points, 20),
        netLatest: latest.net,
        cumulativeNet: latest.cumulative,
        totalBuy,
        totalSell,
        tradingDays: series.length,
        points: series.slice(-60),
    };
}

// ---------- Statistik kunci ----------

export interface ReturnItem {
    label: string;
    value: number;
}

export interface StockStatsView {
    low52w: number;
    high52w: number;
    /** 0..1 — posisi harga terakhir di dalam rentang 52 minggu. */
    rangePosition: number;
    /** Persen jarak dari puncak 52 minggu (<= 0). */
    pctFromHigh: number;
    lastVolume: number;
    avgVolume20: number;
    volumeRatio: number;
    volatility20: number;
    maxDrawdown: number;
    atrPct: number;
    returns: ReturnItem[];
}

export function buildStats(candles: Candle[]): StockStatsView | null {
    const stats = keyStats(candles);
    if (!stats) return null;

    return {
        low52w: stats.low52w,
        high52w: stats.high52w,
        rangePosition: Math.min(Math.max(stats.rangePosition, 0), 1),
        pctFromHigh: stats.pctFromHigh,
        lastVolume: candles[candles.length - 1]?.volume ?? 0,
        avgVolume20: stats.avgVolume20,
        volumeRatio: stats.volumeRatio,
        volatility20: stats.volatility20,
        maxDrawdown: stats.maxDrawdown,
        atrPct: stats.atrPct,
        returns: [
            { label: "1 Minggu", value: stats.change1w },
            { label: "1 Bulan", value: stats.change1m },
            { label: "3 Bulan", value: stats.change3m },
            { label: "1 Tahun", value: stats.change1y },
        ],
    };
}

// ---------- Support & resistance ----------

export interface LevelView {
    price: number;
    /** Jarak dari harga terakhir dalam persen (selalu positif). */
    distancePct: number;
    touches: number;
}

export interface LevelsView {
    supports: LevelView[];
    resistances: LevelView[];
    /** Rentang low–high yang membingkai seluruh level, untuk skala bar. */
    bounds: { low: number; high: number };
}

export function buildLevels(candles: Candle[], lastClose: number): LevelsView {
    const empty: LevelsView = { supports: [], resistances: [], bounds: { low: 0, high: 0 } };
    if (candles.length < 11 || lastClose <= 0) return empty;

    const { supports, resistances } = supportResistance(candles, { lookback: 5, tolerancePct: 0.015, maxLevels: 4 });
    if (supports.length === 0 && resistances.length === 0) return empty;

    const toView = (level: { price: number; touches: number }): LevelView => ({
        price: level.price,
        distancePct: ((level.price - lastClose) / lastClose) * 100,
        touches: level.touches,
    });

    const prices = [...supports, ...resistances].map((level) => level.price);

    return {
        supports: supports.map(toView),
        resistances: resistances.map(toView),
        bounds: { low: Math.min(...prices, lastClose), high: Math.max(...prices, lastClose) },
    };
}

// ---------- Label tren ----------

export const FLOW_TREND_LABEL: Record<FlowTrend, string> = {
    ACCUMULATION: "Akumulasi asing",
    DISTRIBUTION: "Distribusi asing",
    NEUTRAL: "Netral",
};
