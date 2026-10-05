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
    MOCK_CORPORATE_ACTIONS,
    MOCK_NEWS,
    MOCK_PORTFOLIO,
    MOCK_QUOTES,
    MOCK_SIGNAL_LOGS,
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
    const [config, account, positions, trades, strategy] = await Promise.all([
        safe("botConfig", () => prisma.botConfig.findFirst()),
        safe("paperAccount", () => prisma.paperAccount.findFirst({ orderBy: { updatedAt: "desc" } })),
        safe("positions", () => prisma.position.findMany({ where: { mode: "PAPER" } })),
        getTrades(10),
        // Risk params disimpan per strategi (ditulis dari halaman Settings).
        safe("botStrategy", () =>
            prisma.strategy.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } }),
        ),
    ]);

    const risk = {
        ...DEFAULT_RISK_PARAMS,
        ...((strategy?.riskParamsJson ?? {}) as Partial<typeof DEFAULT_RISK_PARAMS>),
    };

    return {
        mode: config?.mode ?? "SIGNAL_ONLY",
        status: config?.status ?? "STOPPED",
        killSwitch: config?.killSwitch ?? false,
        balance: account ? num(account.balance) : 10_000_000,
        initialBalance: account ? num(account.initialBalance) : 10_000_000,
        openPositions: positions?.length ?? 0,
        trades,
        risk: {
            stopLoss: risk.stopLossPct,
            takeProfit: risk.takeProfitPct,
            riskPerPosition: risk.riskPerPositionPct,
            dailyLossLimit: risk.dailyLossLimitPct,
            maxPositions: risk.maxPositions,
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

// ---------- Portofolio ----------

export interface PortfolioHoldingView {
    ticker: string;
    name: string;
    shares: number;
    lots: number;
    avgPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    dailyChangePct: number;
    sector: string;
    weightPct: number;
}

export interface PortfolioView {
    totalValue: number;
    totalInvested: number;
    todayPnl: number;
    todayPnlPct: number;
    totalPnl: number;
    totalPnlPct: number;
    cashBalance: number;
    holdings: PortfolioHoldingView[];
    sectorAllocation: { sector: string; value: number; percentage: number; color: string }[];
    performance: { date: string; value: number }[];
    isDemo: boolean;
}

const SECTOR_COLORS = ["#2F81F7", "#22D3EE", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#EC4899"];

function mockPortfolio(): PortfolioView {
    return {
        totalValue: MOCK_PORTFOLIO.totalValue,
        totalInvested: MOCK_PORTFOLIO.totalInvested,
        todayPnl: MOCK_PORTFOLIO.todayPnl,
        todayPnlPct: MOCK_PORTFOLIO.todayPnlPct,
        totalPnl: MOCK_PORTFOLIO.totalPnl,
        totalPnlPct: MOCK_PORTFOLIO.totalPnlPct,
        cashBalance: MOCK_PORTFOLIO.cashBalance,
        holdings: MOCK_PORTFOLIO.holdings.map((h) => ({
            ticker: h.ticker,
            name: h.companyName,
            shares: h.shares,
            lots: h.lots,
            avgPrice: h.avgBuyPrice,
            currentPrice: h.currentPrice,
            marketValue: h.marketValue,
            unrealizedPnl: h.unrealizedPnl,
            unrealizedPnlPct: h.unrealizedPnlPct,
            dailyChangePct: h.dailyChangePct,
            sector: h.sector,
            weightPct: h.weightPct,
        })),
        sectorAllocation: MOCK_PORTFOLIO.sectorAllocation,
        performance: MOCK_PORTFOLIO.performanceChart,
        isDemo: true,
    };
}

/** Portofolio dari posisi paper trading di DB; fallback ke data contoh. */
export async function getPortfolio(): Promise<PortfolioView> {
    const [account, positions, closedTrades] = await Promise.all([
        safe("portfolioAccount", () => prisma.paperAccount.findFirst({ orderBy: { updatedAt: "desc" } })),
        safe("portfolioPositions", () =>
            prisma.position.findMany({
                where: { mode: "PAPER" },
                include: {
                    stock: {
                        include: { priceBars: { orderBy: { timestamp: "desc" }, take: 2 } },
                    },
                },
            }),
        ),
        safe("portfolioClosedTrades", () =>
            prisma.trade.findMany({
                where: { mode: "PAPER", status: "CLOSED", pnl: { not: null }, closedAt: { not: null } },
                orderBy: { closedAt: "asc" },
                select: { closedAt: true, pnl: true },
            }),
        ),
    ]);

    if (!positions || positions.length === 0) return mockPortfolio();

    const holdings: PortfolioHoldingView[] = [];
    let todayPnl = 0;

    for (const position of positions) {
        const bars = position.stock.priceBars;
        if (bars.length === 0) continue;
        const currentPrice = num(bars[0]!.close);
        const prevClose = num(bars[1]?.close ?? bars[0]!.close);
        const qty = position.qty;
        const avgPrice = num(position.avgEntry);
        const marketValue = qty * currentPrice;
        const invested = qty * avgPrice;
        const unrealizedPnl = marketValue - invested;

        todayPnl += qty * (currentPrice - prevClose);
        holdings.push({
            ticker: position.stock.ticker,
            name: position.stock.name,
            shares: qty,
            lots: Math.round(qty / 100),
            avgPrice: round(avgPrice),
            currentPrice: round(currentPrice),
            marketValue: round(marketValue),
            unrealizedPnl: round(unrealizedPnl),
            unrealizedPnlPct: invested > 0 ? round((unrealizedPnl / invested) * 100) : 0,
            dailyChangePct: prevClose > 0 ? round(((currentPrice - prevClose) / prevClose) * 100) : 0,
            sector: position.stock.sector ?? "Lainnya",
            weightPct: 0,
        });
    }

    const cashBalance = account ? num(account.balance) : 0;
    const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const totalValue = holdingsValue + cashBalance;
    const totalInvested = holdings.reduce((sum, h) => sum + h.shares * h.avgPrice, 0);
    const totalPnl = holdingsValue - totalInvested;

    for (const holding of holdings) {
        holding.weightPct = totalValue > 0 ? round((holding.marketValue / totalValue) * 100, 1) : 0;
    }

    const bySector = new Map<string, number>();
    for (const holding of holdings) {
        bySector.set(holding.sector, (bySector.get(holding.sector) ?? 0) + holding.marketValue);
    }
    const sectorAllocation = [...bySector.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([sector, value], i) => ({
            sector,
            value: round(value),
            percentage: holdingsValue > 0 ? round((value / holdingsValue) * 100, 1) : 0,
            color: SECTOR_COLORS[i % SECTOR_COLORS.length]!,
        }));

    // Equity curve dari riwayat trade tertutup: mulai dari modal awal, lalu
    // tambahkan PnL realisasi tiap trade, ditutup dengan nilai portofolio kini.
    const performance: { date: string; value: number }[] = [];
    const closed = closedTrades ?? [];
    if (closed.length > 0) {
        const initial = account ? num(account.initialBalance) : 0;
        const dayOf = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
        let running = initial;
        performance.push({ date: dayOf(closed[0]!.closedAt), value: round(initial) });
        for (const trade of closed) {
            running += num(trade.pnl);
            performance.push({ date: dayOf(trade.closedAt), value: round(running) });
        }
        performance.push({ date: dayOf(new Date()), value: round(totalValue) });
    }

    return {
        totalValue: round(totalValue),
        totalInvested: round(totalInvested),
        todayPnl: round(todayPnl),
        todayPnlPct: totalValue > 0 ? round((todayPnl / totalValue) * 100) : 0,
        totalPnl: round(totalPnl),
        totalPnlPct: totalInvested > 0 ? round((totalPnl / totalInvested) * 100) : 0,
        cashBalance: round(cashBalance),
        holdings: holdings.sort((a, b) => b.marketValue - a.marketValue),
        sectorAllocation,
        performance,
        isDemo: false,
    };
}

// ---------- Analisis teknikal multi-saham ----------

export type TrendLabel = "bullish" | "bearish" | "neutral";

export interface TechnicalRow {
    ticker: string;
    name: string;
    price: number;
    changePct: number;
    ma20: number | null;
    ma50: number | null;
    rsi: number | null;
    macdHistogram: number | null;
    bollingerPosition: "upper" | "middle" | "lower" | null;
    atr: number | null;
    trend: TrendLabel;
}

function buildTechnicalRow(ticker: string, name: string, candles: CandleView[]): TechnicalRow | null {
    if (candles.length < 2) return null;
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
    const prev = closes[i - 1]!;
    const ma20 = sma(closes, 20)[i];
    const ma50 = sma(closes, 50)[i];
    const rsi14 = rsi(closes, 14)[i];
    const histogram = macd(closes).histogram[i];
    const bb = bollinger(closes, 20, 2);
    const atr14 = atr(engineCandles, 14)[i];

    const aboveMa50 = ma50 != null ? price > ma50 : null;
    const macdBullish = histogram != null ? histogram > 0 : null;
    const trend: TrendLabel =
        aboveMa50 == null || macdBullish == null
            ? "neutral"
            : aboveMa50 && macdBullish
              ? "bullish"
              : !aboveMa50 && !macdBullish
                ? "bearish"
                : "neutral";

    const bollingerPosition =
        bb.upper[i] == null || bb.lower[i] == null
            ? null
            : price > bb.upper[i]!
              ? "upper"
              : price < bb.lower[i]!
                ? "lower"
                : "middle";

    return {
        ticker,
        name,
        price: round(price),
        changePct: prev > 0 ? round(((price - prev) / prev) * 100) : 0,
        ma20: ma20 == null ? null : round(ma20),
        ma50: ma50 == null ? null : round(ma50),
        rsi: rsi14 == null ? null : round(rsi14, 1),
        macdHistogram: histogram == null ? null : round(histogram, 1),
        bollingerPosition,
        atr: atr14 == null ? null : round(atr14, 1),
        trend,
    };
}

/** Ringkasan indikator untuk semua saham aktif; fallback ke data contoh. */
export async function getTechnicalOverview(): Promise<TechnicalRow[]> {
    const rows = await safe("getTechnicalOverview", () =>
        prisma.stock.findMany({
            where: { isActive: true },
            orderBy: { ticker: "asc" },
            take: 60,
            include: { priceBars: { orderBy: { timestamp: "desc" }, take: 120 } },
        }),
    );

    if (!rows || rows.length === 0) {
        return MOCK_QUOTES.map((q) =>
            buildTechnicalRow(
                q.ticker,
                q.name,
                generateMockCandles(q.price * 0.9, 120, q.price % 100),
            ),
        ).filter((row): row is TechnicalRow => row != null);
    }

    return rows
        .filter((s) => s.priceBars.length >= 2)
        .map((s) => buildTechnicalRow(s.ticker, s.name, barsToCandles([...s.priceBars].reverse())))
        .filter((row): row is TechnicalRow => row != null);
}

// ---------- Berita ----------

export interface NewsView {
    id: string;
    source: string;
    title: string;
    url: string;
    publishedAt: string;
    aiSummary: string;
    aiSentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
    relatedTickers: string[];
    isDemo: boolean;
}

function toSentiment(value: unknown): NewsView["aiSentiment"] {
    return value === "POSITIVE" || value === "NEGATIVE" ? value : "NEUTRAL";
}

/** Berita dari DB (hasil pipeline RSS + ringkasan AI); fallback ke contoh. */
export async function getNews(limit = 30, ticker?: string): Promise<NewsView[]> {
    const rows = await safe("getNews", () =>
        prisma.news.findMany({
            where: ticker ? { relatedTickers: { has: ticker.toUpperCase() } } : undefined,
            orderBy: { publishedAt: "desc" },
            take: limit,
        }),
    );

    if (!rows || rows.length === 0) {
        return MOCK_NEWS.filter(
            (n) => !ticker || n.relatedTickers.includes(ticker.toUpperCase()),
        )
            .slice(0, limit)
            .map((n) => ({
                id: n.id,
                source: n.source,
                title: n.title,
                url: n.url,
                publishedAt: n.publishedAt,
                aiSummary: n.aiSummary,
                aiSentiment: n.aiSentiment,
                relatedTickers: n.relatedTickers,
                isDemo: true,
            }));
    }

    return rows.map((n) => ({
        id: n.id,
        source: n.source,
        title: n.title,
        url: n.url,
        publishedAt: n.publishedAt.toISOString(),
        aiSummary: n.aiSummary ?? "Ringkasan belum tersedia.",
        aiSentiment: toSentiment(n.aiSentiment),
        relatedTickers: n.relatedTickers,
        isDemo: false,
    }));
}

/** Ticker yang punya berita — untuk chip filter di halaman berita. */
export async function getNewsTickers(): Promise<string[]> {
    const rows = await safe("getNewsTickers", () =>
        prisma.news.findMany({ select: { relatedTickers: true }, orderBy: { publishedAt: "desc" }, take: 200 }),
    );
    const fromMock = MOCK_NEWS.flatMap((n) => n.relatedTickers);
    const all = rows && rows.length > 0 ? rows.flatMap((n) => n.relatedTickers) : fromMock;
    return [...new Set(all)].filter((t) => t !== "IHSG").sort().slice(0, 12);
}

// ---------- Signal Log & performa strategi (PRD §4.6) ----------

export interface SignalLogView {
    id: string;
    ticker: string;
    strategyType: string;
    direction: string;
    matchedAt: string;
    reasons: string[];
    price: number | null;
    execution: string;
    /** PnL dari trade yang tertaut ke sinyal ini (null bila belum dieksekusi). */
    pnl: number | null;
    rsi14: number | null;
    volumeRatio: number | null;
    isDemo: boolean;
}

export interface StrategyPerformance {
    strategyType: string;
    matches: number;
    executed: number;
    closed: number;
    wins: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
}

export interface RuleFrequency {
    rule: string;
    matches: number;
    wins: number;
    winRate: number;
}

interface SignalLogSnapshot {
    direction?: string;
    reasons?: string[];
    price?: number;
    execution?: string;
    indicators?: { rsi14?: number | null; volumeRatio?: number | null };
}

interface LoadedSignalLog {
    id: string;
    ticker: string;
    strategyType: string;
    matchedAt: Date;
    snapshot: SignalLogSnapshot;
    pnl: number | null;
    tradeStatus: string | null;
}

/** Ambil SignalLog terbaru + PnL trade yang tertaut (via signalId). */
async function loadSignalLogs(limit = 500): Promise<LoadedSignalLog[] | null> {
    const rows = await safe("signalLogs", () =>
        prisma.signalLog.findMany({ orderBy: { matchedAt: "desc" }, take: limit }),
    );
    if (!rows || rows.length === 0) return null;

    const signalIds = rows.map((row) => row.signalId).filter((id): id is string => Boolean(id));
    const trades = signalIds.length
        ? await safe("signalLogTrades", () =>
              prisma.trade.findMany({
                  where: { signalId: { in: signalIds } },
                  select: { signalId: true, pnl: true, status: true },
              }),
          )
        : [];

    const tradeBySignal = new Map<string, { pnl: number | null; status: string }>();
    for (const trade of trades ?? []) {
        if (!trade.signalId) continue;
        const existing = tradeBySignal.get(trade.signalId);
        const pnl = trade.pnl == null ? null : num(trade.pnl);
        // Satu sinyal bisa punya beberapa trade (masuk + keluar). Yang dipakai
        // untuk menilai hasil adalah PnL realisasi, dan status paling akhir.
        const merged: { pnl: number | null; status: string } = {
            pnl: existing?.pnl == null ? (pnl ?? existing?.pnl ?? null) : existing.pnl + (pnl ?? 0),
            status: trade.status === "CLOSED" || existing?.status === "CLOSED" ? "CLOSED" : trade.status,
        };
        tradeBySignal.set(trade.signalId, merged);
    }

    return rows.map((row) => {
        const linked = row.signalId ? tradeBySignal.get(row.signalId) : undefined;
        return {
            id: row.id,
            ticker: row.ticker,
            strategyType: row.strategyType,
            matchedAt: row.matchedAt,
            snapshot: (row.snapshotJson ?? {}) as SignalLogSnapshot,
            pnl: linked?.pnl ?? null,
            tradeStatus: linked?.status ?? null,
        };
    });
}

/** Riwayat sinyal (arsip kondisi saat match + hasil eksekusi). */
export async function getSignalLog(limit = 40): Promise<SignalLogView[]> {
    const rows = await loadSignalLogs();
    if (!rows) {
        return MOCK_SIGNAL_LOGS.slice(0, limit).map((log) => ({
            id: log.id,
            ticker: log.ticker,
            strategyType: log.strategyType,
            direction: log.direction,
            matchedAt: log.matchedAt,
            reasons: log.conditionSnapshot.split(" · "),
            price: log.price,
            execution: "not-executed",
            pnl: null,
            rsi14: null,
            volumeRatio: null,
            isDemo: true,
        }));
    }

    return rows.slice(0, limit).map((row) => ({
        id: row.id,
        ticker: row.ticker,
        strategyType: row.strategyType,
        direction: row.snapshot.direction ?? "WATCH",
        matchedAt: row.matchedAt.toISOString(),
        reasons: row.snapshot.reasons ?? [],
        price: row.snapshot.price ?? null,
        execution: row.snapshot.execution ?? "not-executed",
        pnl: row.pnl,
        rsi14: row.snapshot.indicators?.rsi14 ?? null,
        volumeRatio: row.snapshot.indicators?.volumeRatio ?? null,
        isDemo: false,
    }));
}

/** Performa per gaya trading: berapa kali match, berapa dieksekusi, win rate, total PnL. */
export async function getStrategyPerformance(): Promise<StrategyPerformance[]> {
    const rows = await loadSignalLogs();
    if (!rows) return [];

    const byStrategy = new Map<string, StrategyPerformance>();
    for (const row of rows) {
        const entry = byStrategy.get(row.strategyType) ?? {
            strategyType: row.strategyType,
            matches: 0,
            executed: 0,
            closed: 0,
            wins: 0,
            winRate: 0,
            totalPnl: 0,
            avgPnl: 0,
        };
        entry.matches++;
        if (row.tradeStatus != null) entry.executed++;
        if (row.pnl != null) {
            entry.closed++;
            entry.totalPnl += row.pnl;
            if (row.pnl > 0) entry.wins++;
        }
        byStrategy.set(row.strategyType, entry);
    }

    return [...byStrategy.values()]
        .map((entry) => ({
            ...entry,
            totalPnl: round(entry.totalPnl),
            avgPnl: entry.closed > 0 ? round(entry.totalPnl / entry.closed) : 0,
            winRate: entry.closed > 0 ? round((entry.wins / entry.closed) * 100, 1) : 0,
        }))
        .sort((a, b) => b.matches - a.matches);
}

/** Rule mana yang paling sering match (dan seberapa sering menang). */
export async function getRuleFrequency(): Promise<RuleFrequency[]> {
    const rows = await loadSignalLogs();
    if (!rows) return [];

    const byRule = new Map<string, RuleFrequency>();
    for (const row of rows) {
        for (const reason of row.snapshot.reasons ?? []) {
            const entry = byRule.get(reason) ?? { rule: reason, matches: 0, wins: 0, winRate: 0 };
            entry.matches++;
            if (row.pnl != null && row.pnl > 0) entry.wins++;
            byRule.set(reason, entry);
        }
    }

    return [...byRule.values()]
        .map((entry) => ({
            ...entry,
            winRate: entry.matches > 0 ? round((entry.wins / entry.matches) * 100, 1) : 0,
        }))
        .sort((a, b) => b.matches - a.matches)
        .slice(0, 8);
}

// ---------- Kalender corporate action ----------

export interface CorporateActionView {
    id: string;
    ticker: string;
    type: string;
    title: string;
    cumDate: string;
    exDate: string;
    paymentDate: string | null;
    detail: string | null;
    daysUntilCumDate: number;
}

/** Corporate action dari DB; fallback ke data contoh agar kalender tetap terlihat. */
export async function getCorporateActions(daysAhead = 30): Promise<CorporateActionView[]> {
    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const rows = await safe("getCorporateActions", () =>
        prisma.corporateAction.findMany({
            where: { cumDate: { gte: now, lte: until } },
            orderBy: { cumDate: "asc" },
            take: 20,
        }),
    );

    if (!rows || rows.length === 0) {
        return MOCK_CORPORATE_ACTIONS.map((ca) => ({
            id: ca.id,
            ticker: ca.ticker,
            type: ca.type,
            title: ca.title,
            cumDate: ca.cumDate,
            exDate: ca.exDate,
            paymentDate: ca.paymentDate ?? null,
            detail: ca.detail,
            daysUntilCumDate: ca.daysUntilCumDate,
        }));
    }

    return rows.map((ca) => ({
        id: ca.id,
        ticker: ca.ticker,
        type: ca.type,
        title: ca.title,
        cumDate: ca.cumDate.toISOString().slice(0, 10),
        exDate: ca.exDate.toISOString().slice(0, 10),
        paymentDate: ca.paymentDate?.toISOString().slice(0, 10) ?? null,
        detail: ca.detail,
        daysUntilCumDate: Math.max(0, Math.ceil((ca.cumDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))),
    }));
}
