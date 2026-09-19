/**
 * @stock-analyst/shared — Tipe domain & konstanta bersama.
 * Dipakai oleh web, worker, dan engine agar kontrak data konsisten end-to-end.
 */

// ---------- Saham & Data Pasar ----------

export type Exchange = "IDX";

export interface Stock {
    id: string;
    ticker: string; // contoh: "BBCA.JK"
    name: string;
    exchange: Exchange;
    sector?: string | null;
    board?: string | null; // MAIN / DEV / IDX30 dll
    isActive: boolean;
    yahooSymbol: string;
}

export interface PriceBar {
    stockId: string;
    timestamp: Date; // session date
    open: number;
    high: number;
    low: number;
    close: number;
    adjClose: number;
    volume: number;
    foreignBuy?: number;
    foreignSell?: number;
    netForeign?: number;
    source: string;
    isAdjusted: boolean;
}

export type Timeframe = "1D" | "1W" | "1M";

// ---------- Indikator Teknikal ----------

export interface IndicatorSnapshot {
    stockId: string;
    date: Date;
    timeframe: Timeframe;
    indicators: TechnicalIndicators;
}

export interface TechnicalIndicators {
    ma20?: number;
    ma50?: number;
    ma200?: number;
    ema12?: number;
    ema26?: number;
    rsi14?: number;
    macd?: {
        macd: number;
        signal: number;
        histogram: number;
    };
    bollinger?: {
        upper: number;
        middle: number;
        lower: number;
    };
    atr14?: number;
    volumeSma20?: number;
}

// ---------- Fundamental ----------

export interface FundamentalSnapshot {
    stockId: string;
    asOfDate: Date;
    pbv?: number | null;
    per?: number | null;
    roe?: number | null;
    eps?: number | null;
    revenue?: number | null;
    netIncome?: number | null;
    divYield?: number | null;
    marketCap?: number | null;
    source: string;
    confidence: number; // 0..1
}

// ---------- Sinyal ----------

export type SignalSource = "TECHNICAL" | "FUNDAMENTAL" | "AI" | "RULE";
export type SignalDirection = "BUY" | "SELL" | "WATCH";
export type SignalStatus = "NEW" | "NOTIFIED" | "EXECUTED" | "EXPIRED";
export type StrategyType = "BSJP" | "BPJS" | "SWING";

export interface Signal {
    id: string;
    stockId: string;
    strategyId?: string | null;
    strategyType?: StrategyType;
    source: SignalSource;
    direction: SignalDirection;
    reason: string[]; // rule yang terpenuhi
    price: number;
    strength: number; // 0..1
    createdAt: Date;
    status: SignalStatus;
    detailsJson?: Record<string, unknown>;
}

// ---------- Strategi & Bot ----------

export type StrategyMode = "SIGNAL_ONLY" | "PAPER" | "LIVE";

export interface RiskParams {
    stopLossPct: number;
    takeProfitPct: number;
    riskPerPositionPct: number;
    dailyLossLimitPct: number;
    maxPositions: number;
}

export interface Strategy {
    id: string;
    userId: string;
    name: string;
    stockIds: string[];
    entryRules: RuleConfig[];
    exitRules: RuleConfig[];
    timeframe: Timeframe;
    riskParams: RiskParams;
    mode: StrategyMode;
    isActive: boolean;
    version: number;
}

export type RuleType =
    | "MA_CROSS"
    | "RSI_OVERSOLD"
    | "RSI_OVERBOUGHT"
    | "MACD_CROSS"
    | "BOLLINGER_BREAK"
    | "PRICE_ABOVE_MA"
    | "PRICE_BELOW_MA"
    | "FUNDAMENTAL_PBV_LOW"
    | "FUNDAMENTAL_PER_LOW"
    | "AI_SCORE";

export interface RuleConfig {
    type: RuleType;
    params: Record<string, number | string | boolean>;
}

// ---------- Alert ----------

export type AlertType = "PRICE_ABOVE" | "PRICE_BELOW" | "SIGNAL" | "CHANNEL_BREAK";
export type AlertStatus = "ACTIVE" | "TRIGGERED" | "DISABLED";

export interface Alert {
    id: string;
    userId: string;
    stockId: string;
    type: AlertType;
    condition: Record<string, number | string>;
    repeat: boolean;
    status: AlertStatus;
    lastTriggeredAt?: Date | null;
}

// ---------- Trading ----------

export type TradeSide = "BUY" | "SELL";
export type TradeMode = "PAPER" | "LIVE";
export type TradeStatus = "OPEN" | "CLOSED" | "CANCELLED" | "REJECTED";

export interface Trade {
    id: string;
    strategyId: string;
    signalId?: string | null;
    stockId: string;
    side: TradeSide;
    mode: TradeMode;
    qty: number;
    price: number;
    fee: number;
    pnl?: number | null;
    status: TradeStatus;
    requestId: string;
    decisionLog: Record<string, unknown>;
    openedAt: Date;
    closedAt?: Date | null;
}

export interface Position {
    id: string;
    strategyId: string;
    stockId: string;
    mode: TradeMode;
    qty: number;
    avgEntry: number;
    currentValue: number;
    unrealizedPnl: number;
    openedAt: Date;
}

// ---------- Notifikasi ----------

export type NotificationType =
    | "PRICE_ALERT"
    | "SIGNAL"
    | "TRADE_EXECUTED"
    | "DAILY_REPORT"
    | "SYSTEM"
    | "ERROR";

export interface NotificationPayload {
    type: NotificationType;
    title: string;
    description: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    color?: number; // Discord embed color
    timestamp?: Date;
}

// ---------- Bot / Monitoring ----------

export type BotStatus = "RUNNING" | "STOPPED" | "ERROR";

export interface BotHealth {
    status: BotStatus;
    lastHeartbeatAt: Date;
    lastJobAt?: Date | null;
    lastError?: string | null;
    uptimeSeconds: number;
}

// ---------- ML ----------

export interface MLPrediction {
    id: string;
    signalId?: string | null;
    modelVersion: string;
    score: number; // 0..1
    label: string;
    confidence: number;
    featuresHash: string;
}

// ---------- Screener ----------

export interface ScreenerFilter {
    field: "per" | "pbv" | "roe" | "marketCap" | "divYield" | "rsi14" | "maCross";
    operator: "gt" | "lt" | "between";
    value: number | [number, number];
}

export interface ScreenerPreset {
    id: string;
    userId: string;
    name: string;
    filters: ScreenerFilter[];
}

// ---------- Broker Summary & Bandarmology (PRD §4.3 & §10.3) ----------

export interface BrokerSummaryItem {
    ticker: string;
    date: string;
    brokerCode: string;
    brokerName?: string;
    buyFreq: number;
    buyVolume: number;
    buyValue: number;
    sellFreq: number;
    sellVolume: number;
    sellValue: number;
    netVolume: number;
    netValue: number;
    investorType: "DOMESTIC" | "FOREIGN";
}

export interface ForeignFlowItem {
    date: string;
    foreignBuy: number;
    foreignSell: number;
    netForeign: number;
    cumulativeNetForeign: number;
}

export interface BrokerSummaryProvider {
    getBrokerSummary(ticker: string, date: string): Promise<BrokerSummaryItem[]>;
    getForeignFlow(ticker: string, from: string, to: string): Promise<ForeignFlowItem[]>;
}

// ---------- Notifier Abstraction (PRD §10.2) ----------

export interface SignalMatch {
    id: string;
    ticker: string;
    strategyType: StrategyType;
    direction: SignalDirection;
    price: number;
    matchedAt: Date;
    conditionSummary: string;
    volume: number;
    foreignNetBuy?: number;
    detailsJson?: Record<string, unknown>;
}

export interface NotificationChannel {
    send(signal: SignalMatch): Promise<void>;
}

// ---------- Corporate Action & Dividen (PRD §4.4) ----------

export type CorporateActionType = "DIVIDEND" | "RUPS" | "RIGHTS_ISSUE" | "STOCK_SPLIT";

export interface CorporateAction {
    id: string;
    ticker: string;
    type: CorporateActionType;
    title: string;
    cumDate: string;
    exDate: string;
    recordDate?: string;
    paymentDate?: string;
    amountOrRatio?: string;
    daysUntilCumDate: number;
    detail?: string;
}

// ---------- Berita & Sentiment AI (PRD §4.5) ----------

export type SentimentTag = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface NewsArticle {
    id: string;
    ticker?: string;
    relatedTickers: string[];
    source: string;
    title: string;
    url: string;
    publishedAt: string;
    aiSummary: string;
    aiSentiment: SentimentTag;
}

// ---------- Portfolio & Transaksi (google-design/prompt.txt) ----------

export interface PortfolioHolding {
    ticker: string;
    companyName: string;
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

export interface PortfolioSummary {
    totalValue: number;
    totalInvested: number;
    todayPnl: number;
    todayPnlPct: number;
    totalPnl: number;
    totalPnlPct: number;
    cashBalance: number;
    holdings: PortfolioHolding[];
    sectorAllocation: { sector: string; value: number; percentage: number }[];
}