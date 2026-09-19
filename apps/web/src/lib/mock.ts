/**
 * Data mock realistis untuk Bursa Efek Indonesia (IDX).
 * Mengacu pada PRD.md dan google-design/prompt.txt.
 * Menggunakan format Rupiah realistis, kode broker riil IDX (YP, CC, ZP, RX, BK, AK, PD, dll),
 * serta strategi sinyal BSJP, BPJS, dan Swing.
 */

import type { StrategyType, SentimentTag } from "@stock-analyst/shared";

export interface MockQuote {
    ticker: string;
    name: string;
    price: number;
    changePct: number;
    changeNominal: number;
    volume: number;
    value: number; // Rupiah
    marketCap: number; // Rupiah
    rsi: number;
    macdSignal: "BULLISH" | "BEARISH" | "NEUTRAL";
    signal: "BUY" | "SELL" | "WATCH" | "NONE";
    activeStrategy: StrategyType | null;
    netForeign5D: number; // Rupiah (positif = net buy, negatif = net sell)
    foreignBuyToday: number;
    foreignSellToday: number;
    per: number;
    pbv: number;
    roe: number;
    divYield: number;
    sector: string;
    sparkline: number[];
}

export const MOCK_QUOTES: MockQuote[] = [
    {
        ticker: "BBCA.JK",
        name: "Bank Central Asia Tbk",
        price: 9750,
        changePct: 1.04,
        changeNominal: 100,
        volume: 68_450_000,
        value: 667_387_500_000,
        marketCap: 1_201_925_000_000_000,
        rsi: 58.4,
        macdSignal: "BULLISH",
        signal: "BUY",
        activeStrategy: "SWING",
        netForeign5D: 245_800_000_000,
        foreignBuyToday: 380_450_000_000,
        foreignSellToday: 210_120_000_000,
        per: 22.4,
        pbv: 4.8,
        roe: 21.8,
        divYield: 2.7,
        sector: "Financials",
        sparkline: [9550, 9600, 9575, 9650, 9625, 9700, 9750],
    },
    {
        ticker: "BBRI.JK",
        name: "Bank Rakyat Indonesia (Persero) Tbk",
        price: 5125,
        changePct: -0.48,
        changeNominal: -25,
        volume: 124_800_000,
        value: 639_600_000_000,
        marketCap: 776_750_000_000_000,
        rsi: 44.2,
        macdSignal: "NEUTRAL",
        signal: "WATCH",
        activeStrategy: "BSJP",
        netForeign5D: -85_200_000_000,
        foreignBuyToday: 180_500_000_000,
        foreignSellToday: 245_300_000_000,
        per: 11.6,
        pbv: 2.1,
        roe: 18.5,
        divYield: 6.2,
        sector: "Financials",
        sparkline: [5250, 5200, 5150, 5175, 5100, 5150, 5125],
    },
    {
        ticker: "BMRI.JK",
        name: "Bank Mandiri (Persero) Tbk",
        price: 6150,
        changePct: 1.65,
        changeNominal: 100,
        volume: 85_600_000,
        value: 526_440_000_000,
        marketCap: 574_000_000_000_000,
        rsi: 62.8,
        macdSignal: "BULLISH",
        signal: "BUY",
        activeStrategy: "BSJP",
        netForeign5D: 184_600_000_000,
        foreignBuyToday: 310_200_000_000,
        foreignSellToday: 154_800_000_000,
        per: 10.4,
        pbv: 1.9,
        roe: 19.4,
        divYield: 5.1,
        sector: "Financials",
        sparkline: [5950, 6000, 6050, 6025, 6075, 6100, 6150],
    },
    {
        ticker: "TLKM.JK",
        name: "Telkom Indonesia (Persero) Tbk",
        price: 2880,
        changePct: -1.37,
        changeNominal: -40,
        volume: 98_300_000,
        value: 283_104_000_000,
        marketCap: 285_300_000_000_000,
        rsi: 38.6,
        macdSignal: "BEARISH",
        signal: "SELL",
        activeStrategy: null,
        netForeign5D: -142_500_000_000,
        foreignBuyToday: 75_200_000_000,
        foreignSellToday: 168_900_000_000,
        per: 16.8,
        pbv: 2.4,
        roe: 14.8,
        divYield: 6.4,
        sector: "Telecommunication",
        sparkline: [2980, 2960, 2940, 2920, 2900, 2920, 2880],
    },
    {
        ticker: "ASII.JK",
        name: "Astra International Tbk",
        price: 5175,
        changePct: 0.98,
        changeNominal: 50,
        volume: 42_150_000,
        value: 218_126_250_000,
        marketCap: 209_500_000_000_000,
        rsi: 54.1,
        macdSignal: "BULLISH",
        signal: "WATCH",
        activeStrategy: "BPJS",
        netForeign5D: 48_900_000_000,
        foreignBuyToday: 112_000_000_000,
        foreignSellToday: 88_500_000_000,
        per: 8.5,
        pbv: 1.15,
        roe: 14.2,
        divYield: 8.1,
        sector: "Consumer Discretionary",
        sparkline: [5050, 5075, 5100, 5075, 5125, 5150, 5175],
    },
    {
        ticker: "ADRO.JK",
        name: "Adaro Energy Indonesia Tbk",
        price: 2740,
        changePct: 1.86,
        changeNominal: 50,
        volume: 64_200_000,
        value: 175_908_000_000,
        marketCap: 87_600_000_000_000,
        rsi: 59.7,
        macdSignal: "BULLISH",
        signal: "BUY",
        activeStrategy: "SWING",
        netForeign5D: 62_100_000_000,
        foreignBuyToday: 95_400_000_000,
        foreignSellToday: 48_100_000_000,
        per: 4.8,
        pbv: 1.08,
        roe: 23.4,
        divYield: 11.2,
        sector: "Energy",
        sparkline: [2650, 2680, 2690, 2710, 2700, 2720, 2740],
    },
    {
        ticker: "BYAN.JK",
        name: "Bayan Resources Tbk",
        price: 18900,
        changePct: 2.16,
        changeNominal: 400,
        volume: 8_400_000,
        value: 158_760_000_000,
        marketCap: 630_000_000_000_000,
        rsi: 67.2,
        macdSignal: "BULLISH",
        signal: "BUY",
        activeStrategy: "BPJS",
        netForeign5D: 94_500_000_000,
        foreignBuyToday: 88_200_000_000,
        foreignSellToday: 32_100_000_000,
        per: 6.2,
        pbv: 1.65,
        roe: 28.9,
        divYield: 9.8,
        sector: "Energy",
        sparkline: [18100, 18300, 18250, 18500, 18650, 18750, 18900],
    },
    {
        ticker: "GOTO.JK",
        name: "GoTo Gojek Tokopedia Tbk",
        price: 75,
        changePct: -2.60,
        changeNominal: -2,
        volume: 840_000_000,
        value: 63_000_000_000,
        marketCap: 90_100_000_000_000,
        rsi: 32.5,
        macdSignal: "BEARISH",
        signal: "WATCH",
        activeStrategy: null,
        netForeign5D: -52_000_000_000,
        foreignBuyToday: 31_000_000_000,
        foreignSellToday: 64_000_000_000,
        per: -12.4,
        pbv: 1.38,
        roe: -11.2,
        divYield: 0.0,
        sector: "Technology",
        sparkline: [82, 80, 78, 79, 77, 76, 75],
    },
    {
        ticker: "ANTM.JK",
        name: "Aneka Tambang Tbk",
        price: 1580,
        changePct: 2.27,
        changeNominal: 35,
        volume: 78_900_000,
        value: 124_662_000_000,
        marketCap: 37_950_000_000_000,
        rsi: 61.5,
        macdSignal: "BULLISH",
        signal: "BUY",
        activeStrategy: "BSJP",
        netForeign5D: 55_400_000_000,
        foreignBuyToday: 64_200_000_000,
        foreignSellToday: 24_800_000_000,
        per: 12.1,
        pbv: 1.52,
        roe: 13.6,
        divYield: 4.8,
        sector: "Basic Materials",
        sparkline: [1510, 1530, 1520, 1545, 1560, 1565, 1580],
    },
    {
        ticker: "BBNI.JK",
        name: "Bank Negara Indonesia (Persero) Tbk",
        price: 5450,
        changePct: 0.93,
        changeNominal: 50,
        volume: 38_500_000,
        value: 209_825_000_000,
        marketCap: 203_200_000_000_000,
        rsi: 55.8,
        macdSignal: "BULLISH",
        signal: "BUY",
        activeStrategy: "SWING",
        netForeign5D: 112_000_000_000,
        foreignBuyToday: 135_000_000_000,
        foreignSellToday: 82_400_000_000,
        per: 9.4,
        pbv: 1.35,
        roe: 15.2,
        divYield: 5.6,
        sector: "Financials",
        sparkline: [5350, 5375, 5400, 5375, 5425, 5400, 5450],
    },
    {
        ticker: "UNTR.JK",
        name: "United Tractors Tbk",
        price: 25400,
        changePct: 0.59,
        changeNominal: 150,
        volume: 6_200_000,
        value: 157_480_000_000,
        marketCap: 94_700_000_000_000,
        rsi: 53.4,
        macdSignal: "NEUTRAL",
        signal: "WATCH",
        activeStrategy: null,
        netForeign5D: 28_400_000_000,
        foreignBuyToday: 74_100_000_000,
        foreignSellToday: 62_300_000_000,
        per: 5.1,
        pbv: 1.18,
        roe: 24.1,
        divYield: 9.5,
        sector: "Industrials",
        sparkline: [25100, 25200, 25150, 25300, 25250, 25350, 25400],
    },
    {
        ticker: "ICBP.JK",
        name: "Indofood CBP Sukses Makmur Tbk",
        price: 11200,
        changePct: 0.45,
        changeNominal: 50,
        volume: 12_400_000,
        value: 138_880_000_000,
        marketCap: 130_600_000_000_000,
        rsi: 51.9,
        macdSignal: "NEUTRAL",
        signal: "NONE",
        activeStrategy: null,
        netForeign5D: 18_600_000_000,
        foreignBuyToday: 54_200_000_000,
        foreignSellToday: 48_500_000_000,
        per: 15.2,
        pbv: 2.8,
        roe: 19.1,
        divYield: 3.4,
        sector: "Consumer Non-Cyclical",
        sparkline: [11100, 11150, 11200, 11150, 11225, 11175, 11200],
    },
];

// ---------- Broker Summary Data (PRD §4.3) ----------

export interface MockBrokerRecord {
    brokerCode: string;
    brokerName: string;
    buyFreq: number;
    buyVolume: number; // lot
    buyValue: number; // Rp
    sellFreq: number;
    sellVolume: number;
    sellValue: number;
    netVolume: number;
    netValue: number;
    investorType: "DOMESTIC" | "FOREIGN";
    consecutiveNetBuyDays: number;
}

export const MOCK_BROKER_SUMMARY: Record<string, MockBrokerRecord[]> = {
    "BBCA.JK": [
        { brokerCode: "ZP", brokerName: "Maybank Sekuritas", buyFreq: 4210, buyVolume: 85_400, buyValue: 83_265_000_000, sellFreq: 1120, sellVolume: 12_100, sellValue: 11_797_500_000, netVolume: 73_300, netValue: 71_467_500_000, investorType: "FOREIGN", consecutiveNetBuyDays: 4 },
        { brokerCode: "RX", brokerName: "Macquarie Sekuritas", buyFreq: 3180, buyVolume: 64_200, buyValue: 62_595_000_000, sellFreq: 890, sellVolume: 9_400, sellValue: 9_165_000_000, netVolume: 54_800, netValue: 53_430_000_000, investorType: "FOREIGN", consecutiveNetBuyDays: 3 },
        { brokerCode: "BK", brokerName: "J.P. Morgan Sekuritas", buyFreq: 2940, buyVolume: 52_100, buyValue: 50_797_500_000, sellFreq: 1450, sellVolume: 18_200, sellValue: 17_745_000_000, netVolume: 33_900, netValue: 33_052_500_000, investorType: "FOREIGN", consecutiveNetBuyDays: 2 },
        { brokerCode: "AK", brokerName: "UBS Sekuritas", buyFreq: 2150, buyVolume: 41_300, buyValue: 40_267_500_000, sellFreq: 980, sellVolume: 11_500, sellValue: 11_212_500_000, netVolume: 29_800, netValue: 29_055_000_000, investorType: "FOREIGN", consecutiveNetBuyDays: 3 },
        { brokerCode: "CC", brokerName: "Mandiri Sekuritas", buyFreq: 5120, buyVolume: 48_600, buyValue: 47_385_000_000, sellFreq: 4890, sellVolume: 46_200, sellValue: 45_045_000_000, netVolume: 2_400, netValue: 2_340_000_000, investorType: "DOMESTIC", consecutiveNetBuyDays: 1 },
        { brokerCode: "YP", brokerName: "Mirae Asset Sekuritas", buyFreq: 6420, buyVolume: 32_100, buyValue: 31_297_500_000, sellFreq: 7890, sellVolume: 84_500, sellValue: 82_387_500_000, netVolume: -52_400, netValue: -51_090_000_000, investorType: "DOMESTIC", consecutiveNetBuyDays: 0 },
        { brokerCode: "PD", brokerName: "Indo Premier Sekuritas", buyFreq: 4890, buyVolume: 24_500, buyValue: 23_887_500_000, sellFreq: 5920, sellVolume: 61_200, sellValue: 59_670_000_000, netVolume: -36_700, netValue: -35_782_500_000, investorType: "DOMESTIC", consecutiveNetBuyDays: 0 },
        { brokerCode: "KZ", brokerName: "CLSA Sekuritas", buyFreq: 1420, buyVolume: 18_200, buyValue: 17_745_000_000, sellFreq: 3120, sellVolume: 42_800, sellValue: 41_730_000_000, netVolume: -24_600, netValue: -23_985_000_000, investorType: "FOREIGN", consecutiveNetBuyDays: 0 },
    ],
    "BBRI.JK": [
        { brokerCode: "CC", brokerName: "Mandiri Sekuritas", buyFreq: 8940, buyVolume: 142_500, buyValue: 73_031_250_000, sellFreq: 5120, sellVolume: 58_400, sellValue: 29_930_000_000, netVolume: 84_100, netValue: 43_101_250_000, investorType: "DOMESTIC", consecutiveNetBuyDays: 3 },
        { brokerCode: "NI", brokerName: "BNI Sekuritas", buyFreq: 6410, buyVolume: 92_100, buyValue: 47_201_250_000, sellFreq: 4200, sellVolume: 41_300, sellValue: 21_166_250_000, netVolume: 50_800, netValue: 26_035_000_000, investorType: "DOMESTIC", consecutiveNetBuyDays: 2 },
        { brokerCode: "BK", brokerName: "J.P. Morgan Sekuritas", buyFreq: 2410, buyVolume: 35_200, buyValue: 18_040_000_000, sellFreq: 6890, sellVolume: 128_400, sellValue: 65_805_000_000, netVolume: -93_200, netValue: -47_765_000_000, investorType: "FOREIGN", consecutiveNetBuyDays: 0 },
        { brokerCode: "ZP", brokerName: "Maybank Sekuritas", buyFreq: 1980, buyVolume: 28_400, buyValue: 14_555_000_000, sellFreq: 5410, sellVolume: 94_200, sellValue: 48_277_500_000, netVolume: -65_800, netValue: -33_722_500_000, investorType: "FOREIGN", consecutiveNetBuyDays: 0 },
    ],
    "BMRI.JK": [
        { brokerCode: "RX", brokerName: "Macquarie Sekuritas", buyFreq: 4120, buyVolume: 112_400, buyValue: 69_126_000_000, sellFreq: 980, sellVolume: 14_200, sellValue: 8_733_000_000, netVolume: 98_200, netValue: 60_393_000_000, investorType: "FOREIGN", consecutiveNetBuyDays: 4 },
        { brokerCode: "BK", brokerName: "J.P. Morgan Sekuritas", buyFreq: 3890, buyVolume: 94_100, buyValue: 57_871_500_000, sellFreq: 1200, sellVolume: 21_500, sellValue: 13_222_500_000, netVolume: 72_600, netValue: 44_649_000_000, investorType: "FOREIGN", consecutiveNetBuyDays: 3 },
    ],
};

export function getBrokerSummaryForTicker(ticker: string): MockBrokerRecord[] {
    if (MOCK_BROKER_SUMMARY[ticker]) return MOCK_BROKER_SUMMARY[ticker];
    return [
        { brokerCode: "YP", brokerName: "Mirae Asset Sekuritas", buyFreq: 3120, buyVolume: 42_500, buyValue: 25_100_000_000, sellFreq: 2890, sellVolume: 35_100, sellValue: 21_200_000_000, netVolume: 7_400, netValue: 3_900_000_000, investorType: "DOMESTIC", consecutiveNetBuyDays: 3 },
        { brokerCode: "CC", brokerName: "Mandiri Sekuritas", buyFreq: 2450, buyVolume: 38_100, buyValue: 22_400_000_000, sellFreq: 1980, sellVolume: 24_200, sellValue: 14_300_000_000, netVolume: 13_900, netValue: 8_100_000_000, investorType: "DOMESTIC", consecutiveNetBuyDays: 2 },
        { brokerCode: "ZP", brokerName: "Maybank Sekuritas", buyFreq: 1890, buyVolume: 28_400, buyValue: 16_800_000_000, sellFreq: 890, sellVolume: 11_200, sellValue: 6_700_000_000, netVolume: 17_200, netValue: 10_100_000_000, investorType: "FOREIGN", consecutiveNetBuyDays: 3 },
        { brokerCode: "PD", brokerName: "Indo Premier Sekuritas", buyFreq: 2100, buyVolume: 19_400, buyValue: 11_500_000_000, sellFreq: 2780, sellVolume: 38_900, sellValue: 23_100_000_000, netVolume: -19_500, netValue: -11_600_000_000, investorType: "DOMESTIC", consecutiveNetBuyDays: 0 },
    ];
}

// ---------- Net Foreign Flow Historis (PRD §4.3) ----------

export interface MockForeignFlowPoint {
    date: string;
    foreignBuy: number;
    foreignSell: number;
    netForeign: number;
    cumulativeNetForeign: number;
}

export function generateForeignFlowHistory(days = 30, baseNet = 10_000_000_000): MockForeignFlowPoint[] {
    const points: MockForeignFlowPoint[] = [];
    let cum = 0;
    const now = new Date("2026-09-18T00:00:00Z");

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        const variation = (Math.sin(i * 0.4) + (Math.random() - 0.45)) * baseNet;
        const buy = Math.abs(variation * 1.5) + 20_000_000_000;
        const sell = Math.abs(variation * 1.2) + 15_000_000_000;
        const net = buy - sell;
        cum += net;

        points.push({
            date: d.toISOString().slice(0, 10),
            foreignBuy: Math.round(buy),
            foreignSell: Math.round(sell),
            netForeign: Math.round(net),
            cumulativeNetForeign: Math.round(cum),
        });
    }
    return points;
}

// ---------- Kalender Dividen & Corporate Action (PRD §4.4) ----------

export interface MockCorporateAction {
    id: string;
    ticker: string;
    name: string;
    type: "DIVIDEND" | "RUPS" | "RIGHTS_ISSUE" | "STOCK_SPLIT";
    title: string;
    cumDate: string;
    exDate: string;
    paymentDate?: string;
    amountOrRatio: string;
    daysUntilCumDate: number;
    detail: string;
}

export const MOCK_CORPORATE_ACTIONS: MockCorporateAction[] = [
    {
        id: "ca-1",
        ticker: "BBCA.JK",
        name: "Bank Central Asia Tbk",
        type: "DIVIDEND",
        title: "Dividen Interim Tunai 2026",
        cumDate: "2026-09-23",
        exDate: "2026-09-24",
        paymentDate: "2026-10-15",
        amountOrRatio: "Rp 50 / saham",
        daysUntilCumDate: 4,
        detail: "Dividen interim tahun buku 2026 sebesar Rp 50 per lembar saham.",
    },
    {
        id: "ca-2",
        ticker: "UNTR.JK",
        name: "United Tractors Tbk",
        type: "DIVIDEND",
        title: "Dividen Interim 2026",
        cumDate: "2026-09-25",
        exDate: "2026-09-26",
        paymentDate: "2026-10-20",
        amountOrRatio: "Rp 650 / saham",
        daysUntilCumDate: 6,
        detail: "Cum-date dividen interim, yield estimasi ~2.5% dari harga penutupan.",
    },
    {
        id: "ca-3",
        ticker: "TLKM.JK",
        name: "Telkom Indonesia (Persero) Tbk",
        type: "RUPS",
        title: "Rapat Umum Pemegang Saham Luar Biasa",
        cumDate: "2026-09-28",
        exDate: "2026-09-29",
        amountOrRatio: "Agenda Strategis Data Center",
        daysUntilCumDate: 9,
        detail: "RUPSLB persetujuan pemisahan (spin-off) unit bisnis data center ke NeutraDC.",
    },
    {
        id: "ca-4",
        ticker: "ASII.JK",
        name: "Astra International Tbk",
        type: "DIVIDEND",
        title: "Dividen Interim 2026",
        cumDate: "2026-10-02",
        exDate: "2026-10-05",
        paymentDate: "2026-10-25",
        amountOrRatio: "Rp 98 / saham",
        daysUntilCumDate: 13,
        detail: "Dividen interim reguler semester 1 tahun buku 2026.",
    },
];

// ---------- Berita & Ringkasan Claude AI (PRD §4.5) ----------

export interface MockNewsItem {
    id: string;
    source: string;
    title: string;
    url: string;
    publishedAt: string;
    timeAgo: string;
    aiSummary: string;
    aiSentiment: SentimentTag;
    relatedTickers: string[];
}

export const MOCK_NEWS: MockNewsItem[] = [
    {
        id: "n-1",
        source: "Bisnis Indonesia",
        title: "Laba Bersih BBCA Tembus Rp 26,8 Triliun di Semester I/2026, Kredit Tumbuh 14,2%",
        url: "https://finansial.bisnis.com/read/20260918/bbca-laba-bersih-kredit",
        publishedAt: "2026-09-18T14:30:00+07:00",
        timeAgo: "2 jam yang lalu",
        aiSummary: "Kinerja BBCA tetap solid berkat ekspansi kredit korporasi & konsumer yang agresif serta margin bunga bersih (NIM) stabil di level 5,6%. Arus kas operasional surplus.",
        aiSentiment: "POSITIVE",
        relatedTickers: ["BBCA.JK"],
    },
    {
        id: "n-2",
        source: "Kontan",
        title: "Asing Borong Saham Bank Mandiri (BMRI) Rp 310 Miliar Jelang Penutupan",
        url: "https://investasi.kontan.co.id/news/broker-asing-akumulasi-bmri",
        publishedAt: "2026-09-18T15:15:00+07:00",
        timeAgo: "1 jam yang lalu",
        aiSummary: "Broker asing (RX, BK) mencatat akumulasi bersih signifikan di BMRI seiring revisi naik target harga konsensus analis ke Rp 7.200.",
        aiSentiment: "POSITIVE",
        relatedTickers: ["BMRI.JK"],
    },
    {
        id: "n-3",
        source: "CNBC Indonesia",
        title: "Harga Batubara Menguat Tipis ke USD 142, Saham ADRO dan BYAN Naik Beriringan",
        url: "https://www.cnbcindonesia.com/market/adro-byan-batubara-naik",
        publishedAt: "2026-09-18T11:20:00+07:00",
        timeAgo: "5 jam yang lalu",
        aiSummary: "Kenaikan permintaan energi jelang musim gugur Eropa menyokong harga batubara global, memberi katalis positif bagi laba kuartal 3 emiten tambang batubara.",
        aiSentiment: "POSITIVE",
        relatedTickers: ["ADRO.JK", "BYAN.JK"],
    },
    {
        id: "n-4",
        source: "IDX Announcement",
        title: "Telkom Indonesia (TLKM) Laporkan Penurunan EBITDA Margin Akibat Biaya Konsolidasi Fiber",
        url: "https://idx.co.id/perusahaan-tercatat/keterbukaan-informasi/tlkm-ebitda",
        publishedAt: "2026-09-17T17:00:00+07:00",
        timeAgo: "1 hari yang lalu",
        aiSummary: "EBITDA TLKM tertekan sebesar 3,2% YoY akibat beban integrasi infrastruktur fixed broadband IndiHome ke Telkomsel, namun manajemen memproyeksikan efisiensi jangka panjang.",
        aiSentiment: "NEGATIVE",
        relatedTickers: ["TLKM.JK"],
    },
    {
        id: "n-5",
        source: "Investor Daily",
        title: "IHSG Ditutup Menguat ke 7.340 Ditopang Penguatan Sektor Finansial & Energi",
        url: "https://investor.id/market/ihsg-menguat-7340",
        publishedAt: "2026-09-18T16:10:00+07:00",
        timeAgo: "40 menit yang lalu",
        aiSummary: "Indeks Harga Saham Gabungan (IHSG) melesat 0,65% di sesi II dengan total transaksi mencapai Rp 11,4 triliun. Net foreign buy harian mencapai Rp 640 miliar.",
        aiSentiment: "POSITIVE",
        relatedTickers: ["IHSG", "BBCA.JK", "BMRI.JK"],
    },
    {
        id: "n-6",
        source: "Bisnis Indonesia",
        title: "GoTo Siapkan Strategi Efisiensi Baru, Targetkan EBITDA Positif Berkelanjutan",
        url: "https://teknologi.bisnis.com/goto-ebitda-positif",
        publishedAt: "2026-09-17T10:00:00+07:00",
        timeAgo: "1 hari yang lalu",
        aiSummary: "GOTO terus memangkas biaya promosi dan memperkuat kolaborasi bersama ekosistem TikTok Shop untuk meningkatkan take-rate komisi e-commerce.",
        aiSentiment: "NEUTRAL",
        relatedTickers: ["GOTO.JK"],
    },
];

// ---------- Portofolio & Transaksi (google-design/prompt.txt) ----------

export interface MockPortfolioHolding {
    ticker: string;
    companyName: string;
    shares: number;
    lots: number;
    avgBuyPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    dailyChangePct: number;
    sector: string;
    weightPct: number;
}

export interface MockPortfolioSummary {
    totalValue: number;
    totalInvested: number;
    todayPnl: number;
    todayPnlPct: number;
    totalPnl: number;
    totalPnlPct: number;
    cashBalance: number;
    ihsgValue: number;
    ihsgChangePct: number;
    isMarketOpen: boolean;
    wibTime: string;
    holdings: MockPortfolioHolding[];
    sectorAllocation: { sector: string; value: number; percentage: number; color: string }[];
    performanceChart: { date: string; value: number }[];
}

export const MOCK_PORTFOLIO: MockPortfolioSummary = {
    totalValue: 245_850_000,
    totalInvested: 207_230_000,
    todayPnl: 2_450_000,
    todayPnlPct: 1.01,
    totalPnl: 38_620_000,
    totalPnlPct: 18.63,
    cashBalance: 42_150_000,
    ihsgValue: 7340.52,
    ihsgChangePct: 0.65,
    isMarketOpen: true,
    wibTime: "14:45 WIB",
    holdings: [
        {
            ticker: "BBCA.JK",
            companyName: "Bank Central Asia Tbk",
            shares: 10_000,
            lots: 100,
            avgBuyPrice: 8750,
            currentPrice: 9750,
            marketValue: 97_500_000,
            unrealizedPnl: 10_000_000,
            unrealizedPnlPct: 11.43,
            dailyChangePct: 1.04,
            sector: "Financials",
            weightPct: 39.6,
        },
        {
            ticker: "BMRI.JK",
            companyName: "Bank Mandiri (Persero) Tbk",
            shares: 10_000,
            lots: 100,
            avgBuyPrice: 5350,
            currentPrice: 6150,
            marketValue: 61_500_000,
            unrealizedPnl: 8_000_000,
            unrealizedPnlPct: 14.95,
            dailyChangePct: 1.65,
            sector: "Financials",
            weightPct: 25.0,
        },
        {
            ticker: "ADRO.JK",
            companyName: "Adaro Energy Indonesia Tbk",
            shares: 15_000,
            lots: 150,
            avgBuyPrice: 2320,
            currentPrice: 2740,
            marketValue: 41_100_000,
            unrealizedPnl: 6_300_000,
            unrealizedPnlPct: 18.10,
            dailyChangePct: 1.86,
            sector: "Energy",
            weightPct: 16.7,
        },
        {
            ticker: "ASII.JK",
            companyName: "Astra International Tbk",
            shares: 7_000,
            lots: 70,
            avgBuyPrice: 5020,
            currentPrice: 5175,
            marketValue: 36_225_000,
            unrealizedPnl: 1_085_000,
            unrealizedPnlPct: 3.09,
            dailyChangePct: 0.98,
            sector: "Consumer Discretionary",
            weightPct: 14.7,
        },
        {
            ticker: "ANTM.JK",
            companyName: "Aneka Tambang Tbk",
            shares: 6_000,
            lots: 60,
            avgBuyPrice: 1490,
            currentPrice: 1580,
            marketValue: 9_480_000,
            unrealizedPnl: 540_000,
            unrealizedPnlPct: 6.04,
            dailyChangePct: 2.27,
            sector: "Basic Materials",
            weightPct: 3.9,
        },
    ],
    sectorAllocation: [
        { sector: "Financials", value: 159_000_000, percentage: 64.6, color: "#2F81F7" },
        { sector: "Energy", value: 41_100_000, percentage: 16.7, color: "#F59E0B" },
        { sector: "Consumer Discretionary", value: 36_225_000, percentage: 14.7, color: "#22D3EE" },
        { sector: "Basic Materials", value: 9_480_000, percentage: 3.9, color: "#10B981" },
    ],
    performanceChart: [
        { date: "2026-03", value: 195_000_000 },
        { date: "2026-04", value: 204_000_000 },
        { date: "2026-05", value: 199_500_000 },
        { date: "2026-06", value: 218_000_000 },
        { date: "2026-07", value: 228_500_000 },
        { date: "2026-08", value: 236_000_000 },
        { date: "2026-09", value: 245_850_000 },
    ],
};

// ---------- Aturan & Riwayat Sinyal (PRD §4.6 & §10.1) ----------

export interface MockSignalRule {
    id: string;
    name: string;
    strategyType: StrategyType;
    tickers: string[];
    conditionSummary: string;
    evaluationSchedule: string;
    isActive: boolean;
    lastMatchedAt: string | null;
}

export const MOCK_SIGNAL_RULES: MockSignalRule[] = [
    {
        id: "rule-bsjp-1",
        name: "BSJP Blue Chip Akumulasi Asing",
        strategyType: "BSJP",
        tickers: ["BBCA.JK", "BMRI.JK", "BBRI.JK", "ANTM.JK"],
        conditionSummary: "Volume spike > 1.4x rata-rata 20 hari AND Net foreign buy > 0 AND Candle bullish tutup di 25% area atas",
        evaluationSchedule: "Sesi Sore (14:30–15:50 WIB)",
        isActive: true,
        lastMatchedAt: "2026-09-18T15:15:00+07:00",
    },
    {
        id: "rule-bpjs-1",
        name: "BPJS Breakout Gap-Up Pagi",
        strategyType: "BPJS",
        tickers: ["ASII.JK", "BYAN.JK", "ADRO.JK"],
        conditionSummary: "Open gap-up > 0.8% AND Volume pagi tinggi AND RSI < 68 (belum overbought)",
        evaluationSchedule: "Sesi Pagi (09:00–10:30 WIB)",
        isActive: true,
        lastMatchedAt: "2026-09-18T09:15:00+07:00",
    },
    {
        id: "rule-swing-1",
        name: "Swing Trend Follower + Bandarmology",
        strategyType: "SWING",
        tickers: ["BBCA.JK", "BBNI.JK", "ADRO.JK", "UNTR.JK"],
        conditionSummary: "EMA20 cross di atas EMA50 AND Akumulasi asing multi-hari > Rp 50 M AND Tanpa berita negatif",
        evaluationSchedule: "End-of-Day (16:00 WIB)",
        isActive: true,
        lastMatchedAt: "2026-09-17T16:05:00+07:00",
    },
];

export interface MockSignalLog {
    id: string;
    ticker: string;
    strategyType: StrategyType;
    direction: "BUY" | "SELL" | "WATCH";
    price: number;
    volume: number;
    matchedAt: string;
    conditionSnapshot: string;
    notifiedChannel: string;
}

export const MOCK_SIGNAL_LOGS: MockSignalLog[] = [
    {
        id: "log-1",
        ticker: "BMRI.JK",
        strategyType: "BSJP",
        direction: "BUY",
        price: 6150,
        volume: 85_600_000,
        matchedAt: "2026-09-18T15:15:00+07:00",
        conditionSnapshot: "Volume spike 1.6x 20d avg · Foreign Net Buy +Rp 155 M · Bullish close",
        notifiedChannel: "#sinyal-bsjp",
    },
    {
        id: "log-2",
        ticker: "ANTM.JK",
        strategyType: "BSJP",
        direction: "BUY",
        price: 1580,
        volume: 78_900_000,
        matchedAt: "2026-09-18T14:45:00+07:00",
        conditionSnapshot: "Volume spike 1.8x · Foreign Net Buy +Rp 39 M · Rebound support",
        notifiedChannel: "#sinyal-bsjp",
    },
    {
        id: "log-3",
        ticker: "BYAN.JK",
        strategyType: "BPJS",
        direction: "BUY",
        price: 18900,
        volume: 8_400_000,
        matchedAt: "2026-09-18T09:15:00+07:00",
        conditionSnapshot: "Buka gap up +1.2% · Volume open aktif · RSI 64.2",
        notifiedChannel: "#sinyal-bpjs",
    },
    {
        id: "log-4",
        ticker: "BBCA.JK",
        strategyType: "SWING",
        direction: "BUY",
        price: 9750,
        volume: 68_450_000,
        matchedAt: "2026-09-17T16:05:00+07:00",
        conditionSnapshot: "EMA20 > EMA50 · Akumulasi broker ZP & RX 3 hari · Net flow +Rp 245 M",
        notifiedChannel: "#sinyal-swing",
    },
];

// ---------- Candlestick Generator Sintetis ----------

export interface MockCandle {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export function generateMockCandles(base = 5000, days = 120, seed = 1): MockCandle[] {
    const out: MockCandle[] = [];
    let price = base;
    let s = seed;
    const rand = () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
    const start = new Date("2026-03-01T00:00:00Z");

    for (let i = 0; i < days; i++) {
        const drift = (rand() - 0.48) * 0.028;
        const open = price;
        const close = price * (1 + drift);
        const high = Math.max(open, close) * (1 + rand() * 0.015);
        const low = Math.min(open, close) * (1 - rand() * 0.015);
        const vol = Math.round(15_000_000 + rand() * 60_000_000);

        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);

        // Lewati akhir pekan
        if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;

        out.push({
            time: d.toISOString().slice(0, 10),
            open: Math.round(open),
            high: Math.round(high),
            low: Math.round(low),
            close: Math.round(close),
            volume: vol,
        });
        price = close;
    }
    return out;
}