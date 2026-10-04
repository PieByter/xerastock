/**
 * Analitik broker summary & foreign flow (PRD 4.3).
 *
 * Semua fungsi di sini murni (tanpa state, tanpa I/O) supaya bisa di-unit-test
 * dan tidak peduli sumber datanya — scraper idx-bei, Index Alpha API, maupun
 * data contoh. Perhitungan tetap sama begitu data asli masuk ke `broker_summary`.
 */

export type InvestorType = "LOCAL" | "FOREIGN";

/** Satu baris broker summary harian (PRD 7: `broker_summary`). */
export interface BrokerRow {
    date: string; // YYYY-MM-DD
    brokerCode: string;
    investorType: InvestorType;
    buyFreq: number;
    buyVolume: number;
    buyValue: number;
    sellFreq: number;
    sellVolume: number;
    sellValue: number;
}

/** Satu titik foreign flow harian (PRD 7: `daily_price.foreign_buy/sell`). */
export interface ForeignFlowPoint {
    date: string;
    foreignBuy: number;
    foreignSell: number;
}

export interface BrokerAggregate {
    brokerCode: string;
    investorType: InvestorType;
    buyValue: number;
    sellValue: number;
    netValue: number;
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
    grossValue: number;
    /** Jumlah hari bursa broker ini muncul di data. */
    days: number;
}

export interface MarketBalance {
    totalBuyValue: number;
    totalSellValue: number;
    netValue: number;
    foreignBuyValue: number;
    foreignSellValue: number;
    foreignNetValue: number;
    localNetValue: number;
}

export interface BrokerStreak {
    brokerCode: string;
    investorType: InvestorType;
    /** Jumlah hari bursa net buy berturut-turut (termasuk hari terakhir). */
    days: number;
    netValue: number;
    since: string;
    until: string;
}

export interface BrokerConcentration {
    /** Herfindahl-Hirschman index atas pangsa gross value (0..1). */
    hhi: number;
    /** Pangsa gross value dari N broker terbesar (0..1). */
    topShare: number;
    topBrokers: number;
}

export type FlowTrend = "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";

/** Net value (beli - jual) satu baris broker. */
export function brokerNetValue(row: BrokerRow): number {
    return row.buyValue - row.sellValue;
}

/** Net volume (beli - jual) satu baris broker. */
export function brokerNetVolume(row: BrokerRow): number {
    return row.buyVolume - row.sellVolume;
}

/** Net foreign flow satu titik (beli - jual). */
export function foreignNetValue(point: ForeignFlowPoint): number {
    return point.foreignBuy - point.foreignSell;
}

/** Agregasi baris broker per kode broker, urut net value menurun. */
export function aggregateBrokers(rows: BrokerRow[]): BrokerAggregate[] {
    const map = new Map<string, BrokerAggregate & { _dates: Set<string> }>();

    for (const row of rows) {
        let agg = map.get(row.brokerCode);
        if (!agg) {
            agg = {
                brokerCode: row.brokerCode,
                investorType: row.investorType,
                buyValue: 0,
                sellValue: 0,
                netValue: 0,
                buyVolume: 0,
                sellVolume: 0,
                netVolume: 0,
                grossValue: 0,
                days: 0,
                _dates: new Set<string>(),
            };
            map.set(row.brokerCode, agg);
        }
        agg.buyValue += row.buyValue;
        agg.sellValue += row.sellValue;
        agg.buyVolume += row.buyVolume;
        agg.sellVolume += row.sellVolume;
        agg._dates.add(row.date);
    }

    const out: BrokerAggregate[] = [];
    for (const agg of map.values()) {
        agg.netValue = agg.buyValue - agg.sellValue;
        agg.netVolume = agg.buyVolume - agg.sellVolume;
        agg.grossValue = agg.buyValue + agg.sellValue;
        agg.days = agg._dates.size;
        delete (agg as Partial<typeof agg>)._dates;
        out.push(agg);
    }

    return out.sort((a, b) => b.netValue - a.netValue || a.brokerCode.localeCompare(b.brokerCode));
}

/** Broker dengan net buy terbesar (hanya yang net positif). */
export function topNetBuyers(aggregates: BrokerAggregate[], limit = 5): BrokerAggregate[] {
    return aggregates.filter((b) => b.netValue > 0).slice(0, limit);
}

/** Broker dengan net sell terbesar (hanya yang net negatif). */
export function topNetSellers(aggregates: BrokerAggregate[], limit = 5): BrokerAggregate[] {
    return aggregates
        .filter((b) => b.netValue < 0)
        .sort((a, b) => a.netValue - b.netValue || a.brokerCode.localeCompare(b.brokerCode))
        .slice(0, limit);
}

/** Total beli/jual & net, dipecah lokal vs asing. */
export function marketBalance(rows: BrokerRow[]): MarketBalance {
    let totalBuyValue = 0;
    let totalSellValue = 0;
    let foreignBuyValue = 0;
    let foreignSellValue = 0;

    for (const row of rows) {
        totalBuyValue += row.buyValue;
        totalSellValue += row.sellValue;
        if (row.investorType === "FOREIGN") {
            foreignBuyValue += row.buyValue;
            foreignSellValue += row.sellValue;
        }
    }

    const foreignNetValue = foreignBuyValue - foreignSellValue;
    return {
        totalBuyValue,
        totalSellValue,
        netValue: totalBuyValue - totalSellValue,
        foreignBuyValue,
        foreignSellValue,
        foreignNetValue,
        localNetValue: totalBuyValue - totalSellValue - foreignNetValue,
    };
}

/**
 * Konsentrasi broker dari gross value (turnover).
 * HHI mendekati 1/`n` = merata, mendekati 1 = dikuasai sedikit broker.
 */
export function brokerConcentration(aggregates: BrokerAggregate[], topBrokers = 5): BrokerConcentration {
    const total = aggregates.reduce((sum, b) => sum + b.grossValue, 0);
    if (total <= 0) return { hhi: 0, topShare: 0, topBrokers };

    const shares = aggregates.map((b) => b.grossValue / total);
    const hhi = shares.reduce((sum, share) => sum + share * share, 0);
    const topShare = aggregates
        .slice()
        .sort((a, b) => b.grossValue - a.grossValue)
        .slice(0, topBrokers)
        .reduce((sum, b) => sum + b.grossValue / total, 0);

    return { hhi, topShare, topBrokers };
}

/**
 * Broker yang net buy `minDays` hari bursa berturut-turut sampai hari terakhir.
 *
 * Hari di mana broker tidak muncul dianggap memutus streak — kita tidak bisa
 * membedakan "tidak ada transaksi" dari "data tidak lengkap", jadi ambil
 * interpretasi yang konservatif.
 */
export function detectNetBuyStreak(rows: BrokerRow[], minDays = 3): BrokerStreak[] {
    const dates = [...new Set(rows.map((r) => r.date))].sort().reverse();
    if (dates.length < minDays) return [];

    const byBroker = new Map<string, Map<string, BrokerRow>>();
    for (const row of rows) {
        let byDate = byBroker.get(row.brokerCode);
        if (!byDate) {
            byDate = new Map<string, BrokerRow>();
            byBroker.set(row.brokerCode, byDate);
        }
        byDate.set(row.date, row);
    }

    const out: BrokerStreak[] = [];
    for (const [brokerCode, byDate] of byBroker) {
        let days = 0;
        let netValue = 0;
        let until = "";
        let since = "";
        let investorType: InvestorType = "LOCAL";

        for (const date of dates) {
            const row = byDate.get(date);
            if (!row) break;
            const net = brokerNetValue(row);
            if (net <= 0) break;
            days += 1;
            netValue += net;
            investorType = row.investorType;
            if (days === 1) until = date;
            since = date;
        }

        if (days >= minDays) {
            out.push({ brokerCode, investorType, days, netValue, since, until });
        }
    }

    return out.sort((a, b) => b.days - a.days || b.netValue - a.netValue);
}

export interface ForeignFlowSeriesPoint extends ForeignFlowPoint {
    net: number;
    /** Net kumulatif sejak titik pertama (PRD 4.3: grafik akumulasi/distribusi). */
    cumulative: number;
}

/** Ubah deret foreign flow jadi deret net + net kumulatif. */
export function buildForeignFlowSeries(points: ForeignFlowPoint[]): ForeignFlowSeriesPoint[] {
    let running = 0;
    return points
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((point) => {
            const net = foreignNetValue(point);
            running += net;
            return { ...point, net, cumulative: running };
        });
}

/** Jumlah net foreign flow `window` hari bursa terakhir. */
export function sumForeignNet(points: ForeignFlowPoint[], window: number): number {
    if (window <= 0) return 0;
    const sorted = points.slice().sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-window).reduce((sum, point) => sum + foreignNetValue(point), 0);
}

/**
 * Tren akumulasi/distribusi asing: bandingkan rata-rata net harian jangka
 * pendek vs jangka panjang.
 */
export function foreignFlowTrend(points: ForeignFlowPoint[], shortWindow = 5, longWindow = 20): FlowTrend {
    const sorted = points.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) return "NEUTRAL";

    const shortSlice = sorted.slice(-shortWindow);
    const longSlice = sorted.slice(-longWindow);
    const shortDaily = shortSlice.reduce((sum, p) => sum + foreignNetValue(p), 0) / shortSlice.length;
    const longDaily = longSlice.reduce((sum, p) => sum + foreignNetValue(p), 0) / longSlice.length;

    if (shortDaily > 0 && shortDaily >= longDaily) return "ACCUMULATION";
    if (shortDaily < 0 && shortDaily <= longDaily) return "DISTRIBUTION";
    return "NEUTRAL";
}
