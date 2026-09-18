/**
 * Data contoh (mock) untuk UI — akan diganti dengan data asli dari DB
 * setelah pipeline data & API route tersedia.
 */

export interface MockQuote {
    ticker: string;
    name: string;
    price: number;
    changePct: number;
    volume: number;
    rsi: number;
    signal: "BUY" | "SELL" | "WATCH" | "NONE";
    per: number;
    pbv: number;
    roe: number;
    divYield: number;
}

export const MOCK_QUOTES: MockQuote[] = [
    { ticker: "BBCA.JK", name: "Bank Central Asia", price: 9750, changePct: 0.62, volume: 8_200_000, rsi: 58.2, signal: "BUY", per: 21.4, pbv: 4.8, roe: 21.2, divYield: 2.6 },
    { ticker: "BBRI.JK", name: "Bank Rakyat Indonesia", price: 5120, changePct: -0.39, volume: 45_100_000, rsi: 44.7, signal: "WATCH", per: 11.8, pbv: 2.1, roe: 18.4, divYield: 5.8 },
    { ticker: "BMRI.JK", name: "Bank Mandiri", price: 6125, changePct: 1.24, volume: 22_400_000, rsi: 61.3, signal: "BUY", per: 10.2, pbv: 1.9, roe: 19.1, divYield: 4.9 },
    { ticker: "TLKM.JK", name: "Telkom Indonesia", price: 2890, changePct: -1.03, volume: 31_800_000, rsi: 39.1, signal: "SELL", per: 18.2, pbv: 2.6, roe: 15.3, divYield: 6.1 },
    { ticker: "ASII.JK", name: "Astra International", price: 5125, changePct: 0.49, volume: 9_700_000, rsi: 52.8, signal: "NONE", per: 8.7, pbv: 1.2, roe: 13.9, divYield: 4.2 },
    { ticker: "BYAN.JK", name: "Bayan Resources", price: 18750, changePct: 2.18, volume: 3_200_000, rsi: 66.4, signal: "BUY", per: 6.4, pbv: 1.7, roe: 28.6, divYield: 9.4 },
    { ticker: "ADRO.JK", name: "Adaro Energy", price: 2710, changePct: 0.74, volume: 18_900_000, rsi: 55.0, signal: "WATCH", per: 4.9, pbv: 1.1, roe: 22.8, divYield: 8.7 },
    { ticker: "GOTO.JK", name: "GoTo Gojek Tokopedia", price: 74, changePct: -2.63, volume: 210_000_000, rsi: 31.2, signal: "WATCH", per: 0, pbv: 1.4, roe: -12.6, divYield: 0 },
];

export interface MockSignal {
    id: string;
    ticker: string;
    direction: "BUY" | "SELL" | "WATCH";
    source: string;
    reason: string;
    price: number;
    strength: number;
    createdAt: string;
}

export const MOCK_SIGNALS: MockSignal[] = [
    {
        id: "sig-1",
        ticker: "BBCA.JK",
        direction: "BUY",
        source: "TECHNICAL",
        reason: "MA20 golden cross MA50 · RSI 58.2",
        price: 9750,
        strength: 0.82,
        createdAt: "2026-09-05T10:15:00+07:00",
    },
    {
        id: "sig-2",
        ticker: "BMRI.JK",
        direction: "BUY",
        source: "TECHNICAL",
        reason: "MACD golden cross · Breakout Bollinger upper",
        price: 6125,
        strength: 0.76,
        createdAt: "2026-09-05T09:45:00+07:00",
    },
    {
        id: "sig-3",
        ticker: "TLKM.JK",
        direction: "SELL",
        source: "FUNDAMENTAL",
        reason: "PER 18.2 di atas threshold · RSI turun dari overbought",
        price: 2890,
        strength: 0.64,
        createdAt: "2026-09-04T15:35:00+07:00",
    },
    {
        id: "sig-4",
        ticker: "GOTO.JK",
        direction: "WATCH",
        source: "AI",
        reason: "AI score 0.71 — potensi reversal oversold",
        price: 74,
        strength: 0.58,
        createdAt: "2026-09-04T15:30:00+07:00",
    },
];

export interface MockTrade {
    id: string;
    ticker: string;
    side: "BUY" | "SELL";
    qty: number;
    price: number;
    pnl: number | null;
    status: string;
    openedAt: string;
}

export const MOCK_TRADES: MockTrade[] = [
    { id: "t-1", ticker: "BBCA.JK", side: "BUY", qty: 100, price: 9600, pnl: null, status: "OPEN", openedAt: "2026-09-03T09:30:00+07:00" },
    { id: "t-2", ticker: "ADRO.JK", side: "BUY", qty: 500, price: 2650, pnl: null, status: "OPEN", openedAt: "2026-09-02T10:05:00+07:00" },
    { id: "t-3", ticker: "TLKM.JK", side: "SELL", qty: 300, price: 2950, pnl: 180_000, status: "CLOSED", openedAt: "2026-08-28T14:20:00+07:00" },
    { id: "t-4", ticker: "BBRI.JK", side: "BUY", qty: 1000, price: 5050, pnl: -120_000, status: "CLOSED", openedAt: "2026-08-25T09:15:00+07:00" },
];

export interface MockCandle {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

/** Generate candlestick sintetis untuk demo chart. */
export function generateMockCandles(base = 5000, days = 120, seed = 1): MockCandle[] {
    const out: MockCandle[] = [];
    let price = base;
    let s = seed;
    const rand = () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
    const start = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < days; i++) {
        const drift = (rand() - 0.48) * 0.03;
        const open = price;
        const close = price * (1 + drift);
        const high = Math.max(open, close) * (1 + rand() * 0.012);
        const low = Math.min(open, close) * (1 - rand() * 0.012);
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        out.push({
            time: d.toISOString().slice(0, 10),
            open: +open.toFixed(2),
            high: +high.toFixed(2),
            low: +low.toFixed(2),
            close: +close.toFixed(2),
        });
        price = close;
    }
    return out;
}