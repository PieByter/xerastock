/**
 * Lapisan data server-side untuk dashboard.
 *
 * Membaca langsung dari Postgres (Prisma) dan menghitung indikator lewat
 * `@stock-analyst/engine`. Kalau database belum dikonfigurasi/kosong, semua
 * fungsi otomatis fallback ke data contoh di `lib/mock.ts` supaya UI tetap
 * bisa dipakai (mode demo).
 *
 * Hanya boleh diimpor dari Server Component / server code.
 */

import { prisma } from "@stock-analyst/db";
import {
    atr,
    bollinger,
    generateSampleBrokerRows,
    lastNonNull,
    macd,
    rsi,
    sma,
    sumForeignFlow,
    type BrokerRow,
    type Candle,
    type ForeignFlowPoint,
} from "@stock-analyst/engine";
import { DEFAULT_RISK_PARAMS } from "@stock-analyst/shared";
import {
    buildBrokerSummary,
    buildForeignFlow,
    buildLevels,
    buildStats,
    type BrokerPeriodKey,
    type BrokerSummaryView,
    type ForeignFlowView,
    type LevelsView,
    type StockStatsView,
} from "./brokerAnalysis";
import {
    MOCK_QUOTES,
    MOCK_SIGNALS,
    MOCK_TRADES,
    generateMockCandles,
    type MockQuote,
} from "./mock";

const DB_TIMEOUT_MS = 2500;

/**
 * MOCK_QUOTES menyimpan sisi beli & jual secara terpisah, sedangkan `Quote`
 * memakai net asing — turunkan di sini supaya angkanya selalu konsisten.
 */
function withForeignNet(mock: MockQuote): Quote {
    return { ...mock, foreignNet1d: mock.foreignBuyToday - mock.foreignSellToday };
}

// ---------- Tipe view (bentuk yang dipakai komponen UI) ----------

export type QuoteSignal = "BUY" | "SELL" | "WATCH" | "NONE";
export type Direction = Exclude<QuoteSignal, "NONE">;

export interface Quote {
    ticker: string;
    name: string;
    price: number;
    changePct: number;
    volume: number;
    rsi: number;
    signal: QuoteSignal;
    per: number;
    pbv: number;
    roe: number;
    divYield: number;
    /** Net foreign hari terakhir (beli - jual, Rp). 0 bila data belum tersedia. */
    foreignNet1d: number;
}

export interface SignalView {
    id: string;
    ticker: string;
    direction: Direction;
    source: string;
    reason: string;
    price: number;
    strength: number;
    createdAt: string;
}

export interface TradeView {
    id: string;
    ticker: string;
    side: "BUY" | "SELL";
    qty: number;
    price: number;
    pnl: number | null;
    status: string;
    openedAt: string;
}

export interface CandleView {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    /** Net foreign (beli - jual) pada hari tersebut, kalau data tersedia. */
    foreignNet?: number;
}

export interface IndicatorView {
    label: string;
    value: string;
    note: string;
}

export interface FundamentalView {
    label: string;
    value: string;
}

export interface StockDetail {
    quote: Quote;
    candles: CandleView[];
    indicators: IndicatorView[];
    fundamentals: FundamentalView[];
    signals: SignalView[];
    /** Statistik kunci: rentang 52 minggu, volatilitas, drawdown, return. */
    stats: StockStatsView | null;
    /** Level support/resistance dari swing point historis. */
    levels: LevelsView;
    /** Broker summary periode terpilih (PRD 4.3); null bila belum ada data. */
    brokerSummary: BrokerSummaryView | null;
    /** Net foreign flow historis + net kumulatif (PRD 4.3). */
    foreignFlow: ForeignFlowView | null;
    /** true bila memakai data contoh (DB kosong / saham belum tersinkron). */
    isDemo: boolean;
}

export interface BotOverview {
    mode: string;
    status: string;
    killSwitch: boolean;
    balance: number;
    initialBalance: number;
    openPositions: number;
    trades: TradeView[];
    risk: {
        stopLoss: number;
        takeProfit: number;
        riskPerPosition: number;
        dailyLossLimit: number;
        maxPositions: number;
    };
}

// ---------- Helper ----------

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const round = (v: number, digits = 2): number => Number(v.toFixed(digits));
const fmtNum = (v: number, digits = 0): string => v.toLocaleString("id-ID", { maximumFractionDigits: digits });

function toQuoteSignal(v: unknown): QuoteSignal {
    return v === "BUY" || v === "SELL" || v === "WATCH" ? v : "NONE";
}

function toDirection(v: unknown): Direction {
    return v === "BUY" || v === "SELL" ? v : "WATCH";
}

function reasonText(value: unknown): string {
    if (Array.isArray(value)) return (value as string[]).join(" · ");
    if (typeof value === "string") return value;
    return JSON.stringify(value);
}

async function withTimeout<T>(promise: Promise<T>, ms = DB_TIMEOUT_MS): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`query timeout ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

let demoNoticeLogged = false;

/** Jalankan query DB; kembalikan null bila DB tidak tersedia/kosong (tanpa melempar). */
async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    if (!process.env.DATABASE_URL) {
        if (!demoNoticeLogged) {
            console.warn("[data] DATABASE_URL belum di-set — dashboard memakai data contoh.");
            demoNoticeLogged = true;
        }
        return null;
    }
    try {
        return await withTimeout(fn());
    } catch (err) {
        console.warn(`[data] ${label} gagal — fallback ke data contoh: ${(err as Error).message}`);
        return null;
    }
}

// ---------- Quotes ----------

type BarsInput = Array<{
    timestamp: Date;
    open: unknown;
    high: unknown;
    low: unknown;
    close: unknown;
    volume: unknown;
    foreignBuyValue?: unknown;
    foreignSellValue?: unknown;
}>;

function barsToCandles(bars: BarsInput): CandleView[] {
    return bars.map((b) => ({
        time: b.timestamp.toISOString().slice(0, 10),
        open: num(b.open),
        high: num(b.high),
        low: num(b.low),
        close: num(b.close),
        volume: num(b.volume),
        foreignNet: num(b.foreignBuyValue) - num(b.foreignSellValue),
    }));
}

interface FundamentalInput {
    per?: unknown;
    pbv?: unknown;
    roe?: unknown;
    eps?: unknown;
    divYield?: unknown;
    marketCap?: unknown;
}

function buildQuote(
    ticker: string,
    name: string,
    candles: CandleView[],
    fundamentals: FundamentalInput | undefined,
    latestSignal: unknown,
): Quote {
    const closes = candles.map((c) => c.close);
    const last = candles[candles.length - 1]!;
    const prev = candles[candles.length - 2] ?? last;
    return {
        ticker,
        name,
        price: last.close,
        changePct: prev.close > 0 ? round(((last.close - prev.close) / prev.close) * 100) : 0,
        volume: last.volume,
        rsi: round(lastNonNull(rsi(closes, 14)) ?? 50, 1),
        signal: toQuoteSignal(latestSignal),
        per: round(num(fundamentals?.per), 1),
        pbv: round(num(fundamentals?.pbv), 1),
        roe: round(num(fundamentals?.roe), 1),
        divYield: round(num(fundamentals?.divYield), 1),
        foreignNet1d: last.foreignNet ?? 0,
    };
}

/** Daftar saham aktif + ringkasan harga/indikator. */
export async function getQuotes(): Promise<Quote[]> {
    const rows = await safe("getQuotes", () =>
        prisma.stock.findMany({
            where: { isActive: true },
            orderBy: { ticker: "asc" },
            take: 60,
            include: {
                priceBars: { orderBy: { timestamp: "desc" }, take: 60 },
                fundamentalSnapshots: { orderBy: { asOfDate: "desc" }, take: 1 },
                signals: { orderBy: { createdAt: "desc" }, take: 1 },
            },
        }),
    );

    if (!rows || rows.length === 0) return MOCK_QUOTES.map(withForeignNet);

    return rows
        .filter((s) => s.priceBars.length >= 2)
        .map((s) => {
            const candles = barsToCandles([...s.priceBars].reverse());
            return buildQuote(s.ticker, s.name, candles, s.fundamentalSnapshots[0], s.signals[0]?.direction);
        });
}

// ---------- Signals ----------

export async function getSignals(limit = 20): Promise<SignalView[]> {
    const rows = await safe("getSignals", () =>
        prisma.signal.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            include: { stock: true },
        }),
    );

    if (!rows || rows.length === 0) return MOCK_SIGNALS;

    return rows.map((s) => ({
        id: s.id,
        ticker: s.stock.ticker,
        direction: toDirection(s.direction),
        source: s.source,
        reason: reasonText(s.reasonJson),
        price: num(s.price),
        strength: s.strength,
        createdAt: s.createdAt.toISOString(),
    }));
}

/** Jumlah sinyal dalam 24 jam terakhir. */
export async function getSignalCount24h(): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await safe("getSignalCount24h", () => prisma.signal.count({ where: { createdAt: { gte: since } } }));
    if (count != null) return count;
    return MOCK_SIGNALS.filter((s) => new Date(s.createdAt).getTime() >= since.getTime()).length;
}

// ---------- Trades & bot ----------

export async function getTrades(limit = 20): Promise<TradeView[]> {
    const rows = await safe("getTrades", () =>
        prisma.trade.findMany({
            orderBy: { openedAt: "desc" },
            take: limit,
            include: { stock: true },
        }),
    );

    if (!rows || rows.length === 0) return MOCK_TRADES;

    return rows.map((t) => ({
        id: t.id,
        ticker: t.stock.ticker,
        side: t.side === "SELL" ? "SELL" : "BUY",
        qty: t.qty,
        price: num(t.price),
        pnl: t.pnl == null ? null : num(t.pnl),
        status: t.status,
        openedAt: t.openedAt.toISOString(),
    }));
}

export async function getBotOverview(): Promise<BotOverview> {
    const [config, account, positions, trades] = await Promise.all([
        safe("botConfig", () => prisma.botConfig.findFirst()),
        safe("paperAccount", () => prisma.paperAccount.findFirst({ orderBy: { updatedAt: "desc" } })),
        safe("positions", () => prisma.position.findMany({ where: { mode: "PAPER" } })),
        getTrades(10),
    ]);

    return {
        mode: config?.mode ?? "SIGNAL_ONLY",
        status: config?.status ?? "STOPPED",
        killSwitch: config?.killSwitch ?? false,
        balance: account ? num(account.balance) : 10_000_000,
        initialBalance: account ? num(account.initialBalance) : 10_000_000,
        openPositions: positions?.length ?? 0,
        trades,
        risk: {
            stopLoss: DEFAULT_RISK_PARAMS.stopLossPct,
            takeProfit: DEFAULT_RISK_PARAMS.takeProfitPct,
            riskPerPosition: DEFAULT_RISK_PARAMS.riskPerPositionPct,
            dailyLossLimit: DEFAULT_RISK_PARAMS.dailyLossLimitPct,
            maxPositions: DEFAULT_RISK_PARAMS.maxPositions,
        },
    };
}

// ---------- Detail per saham ----------

function buildIndicators(candles: CandleView[]): IndicatorView[] {
    if (candles.length < 2) return [];
    const closes = candles.map((c) => c.close);
    const engineCandles: Candle[] = candles.map((c) => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
    }));
    const i = closes.length - 1;
    const price = closes[i]!;

    const rows: IndicatorView[] = [];
    const ma20 = sma(closes, 20)[i];
    const ma50 = sma(closes, 50)[i];
    const rsi14 = rsi(closes, 14)[i];
    const histogram = macd(closes).histogram[i];
    const bb = bollinger(closes, 20, 2);
    const atr14 = atr(engineCandles, 14)[i];

    if (ma20 != null) rows.push({ label: "MA20", value: fmtNum(ma20), note: price >= ma20 ? "harga di atas" : "harga di bawah" });
    if (ma50 != null) rows.push({ label: "MA50", value: fmtNum(ma50), note: price >= ma50 ? "harga di atas" : "harga di bawah" });
    if (rsi14 != null) {
        const note = rsi14 >= 70 ? "overbought" : rsi14 <= 30 ? "oversold" : "netral";
        rows.push({ label: "RSI (14)", value: fmtNum(rsi14, 1), note });
    }
    if (histogram != null) {
        rows.push({
            label: "MACD",
            value: `Histogram ${histogram >= 0 ? "+" : ""}${fmtNum(histogram, 1)}`,
            note: histogram >= 0 ? "bullish" : "bearish",
        });
    }
    if (bb.upper[i] != null && bb.lower[i] != null) {
        rows.push({ label: "Bollinger", value: `${fmtNum(bb.lower[i]!)} – ${fmtNum(bb.upper[i]!)}`, note: "band 20/2" });
    }
    if (atr14 != null) rows.push({ label: "ATR (14)", value: fmtNum(atr14, 1), note: "volatilitas" });

    return rows;
}

function buildFundamentals(f: FundamentalInput | undefined): FundamentalView[] {
    if (!f) return [];
    const value = (v: unknown, suffix = ""): string => (v == null ? "—" : `${fmtNum(num(v), 2)}${suffix}`);
    return [
        { label: "PER", value: value(f.per, "x") },
        { label: "PBV", value: value(f.pbv, "x") },
        { label: "ROE", value: value(f.roe, "%") },
        { label: "EPS", value: f.eps == null ? "—" : fmtNum(num(f.eps)) },
        { label: "Dividend Yield", value: value(f.divYield, "%") },
        {
            label: "Market Cap",
            value: f.marketCap == null ? "—" : `${fmtNum(num(f.marketCap) / 1_000_000_000_000, 2)}T`,
        },
    ];
}

// ---------- Broker summary & foreign flow ----------

/** Berapa hari bursa riwayat broker yang diambil (butuh lebih dari periode terpanjang untuk streak). */
const BROKER_LOOKBACK_DAYS = 60;

/** Baris `broker_summary` dari DB → bentuk yang dipakai `@stock-analyst/engine`. */
function toBrokerRows(
    rows: Array<{
        date: Date;
        brokerCode: string;
        investorType: string;
        buyFreq: number;
        buyVolume: unknown;
        buyValue: unknown;
        sellFreq: number;
        sellVolume: unknown;
        sellValue: unknown;
    }>,
): BrokerRow[] {
    return rows.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        brokerCode: row.brokerCode,
        investorType: row.investorType === "FOREIGN" ? "FOREIGN" : "LOCAL",
        buyFreq: row.buyFreq,
        buyVolume: num(row.buyVolume),
        buyValue: num(row.buyValue),
        sellFreq: row.sellFreq,
        sellVolume: num(row.sellVolume),
        sellValue: num(row.sellValue),
    }));
}

/** Foreign flow harian dari kolom foreign di price bar (PRD 7: `daily_price`). */
function toForeignFlowPoints(bars: BarsInput): ForeignFlowPoint[] {
    return bars
        .map((bar) => ({
            date: bar.timestamp.toISOString().slice(0, 10),
            foreignBuy: num(bar.foreignBuyValue),
            foreignSell: num(bar.foreignSellValue),
        }))
        .filter((point) => point.foreignBuy > 0 || point.foreignSell > 0);
}

/** Data contoh saat DB belum tersedia / saham belum tersinkron. */
function buildDemoStockDetail(ticker: string, period: BrokerPeriodKey): StockDetail | null {
    const mock = MOCK_QUOTES.find((q) => q.ticker === ticker);
    if (!mock) return null;

    const candles = generateMockCandles(mock.price * 0.9, 120, mock.price % 100);
    const analysisCandles: Candle[] = candles.map((c) => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
    }));
    const last = candles[candles.length - 1]!;

    // Broker summary contoh mengikuti tanggal candle supaya sejajar dengan chart.
    const brokerRows = generateSampleBrokerRows({
        dates: candles.slice(-BROKER_LOOKBACK_DAYS).map((c) => c.time),
        dailyTurnover: last.close * last.volume,
        avgPrice: last.close,
        seed: (mock.price % 100) + 7,
    });
    const foreignFlow = buildForeignFlow(sumForeignFlow(brokerRows));
    const quote = withForeignNet(mock);

    return {
        quote: { ...quote, foreignNet1d: foreignFlow?.netLatest ?? quote.foreignNet1d },
        candles,
        indicators: buildIndicators(candles),
        fundamentals: [],
        signals: MOCK_SIGNALS.filter((s) => s.ticker === ticker).map((s) => ({
            ...s,
            direction: toDirection(s.direction),
        })),
        stats: buildStats(analysisCandles),
        levels: buildLevels(analysisCandles, last.close),
        brokerSummary: buildBrokerSummary(brokerRows, period),
        foreignFlow,
        isDemo: true,
    };
}

/** Detail lengkap satu saham; null bila ticker tidak dikenal. */
export async function getStockDetail(
    ticker: string,
    options: { brokerPeriod?: BrokerPeriodKey } = {},
): Promise<StockDetail | null> {
    const upper = ticker.toUpperCase();
    const period = options.brokerPeriod ?? "1d";
    const brokerSince = new Date(Date.now() - (BROKER_LOOKBACK_DAYS + 30) * 24 * 60 * 60 * 1000);

    const record = await safe("getStockDetail", () =>
        prisma.stock.findUnique({
            where: { ticker: upper },
            include: {
                priceBars: { orderBy: { timestamp: "desc" }, take: 260 },
                fundamentalSnapshots: { orderBy: { asOfDate: "desc" }, take: 1 },
                signals: { orderBy: { createdAt: "desc" }, take: 5 },
                brokerSummaries: {
                    where: { date: { gte: brokerSince } },
                    orderBy: { date: "desc" },
                    take: 3000,
                },
            },
        }),
    );

    if (!record) {
        // DB tidak tersedia → demo pakai data contoh.
        return buildDemoStockDetail(upper, period);
    }

    if (record.priceBars.length < 2) {
        // Saham ada tapi belum ada data harga — jangan tebak angka.
        return null;
    }

    const candles = barsToCandles([...record.priceBars].reverse());
    const analysisCandles: Candle[] = candles.map((c) => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
    }));
    const fundamentals = record.fundamentalSnapshots[0];
    const lastClose = candles[candles.length - 1]!.close;

    return {
        quote: buildQuote(record.ticker, record.name, candles, fundamentals, record.signals[0]?.direction),
        candles,
        indicators: buildIndicators(candles),
        fundamentals: buildFundamentals(fundamentals),
        signals: record.signals.map((s) => ({
            id: s.id,
            ticker: record.ticker,
            direction: toDirection(s.direction),
            source: s.source,
            reason: reasonText(s.reasonJson),
            price: num(s.price),
            strength: s.strength,
            createdAt: s.createdAt.toISOString(),
        })),
        stats: buildStats(analysisCandles),
        levels: buildLevels(analysisCandles, lastClose),
        brokerSummary: buildBrokerSummary(toBrokerRows(record.brokerSummaries), period),
        foreignFlow: buildForeignFlow(toForeignFlowPoints([...record.priceBars])),
        isDemo: false,
    };
}
