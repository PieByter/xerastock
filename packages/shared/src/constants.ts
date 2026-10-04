/** Konstanta bersama untuk seluruh aplikasi. */

export const IDX_TZ = "Asia/Jakarta";

/** Jam bursa IDX (WIB). */
export const MARKET = {
    openHour: 9,
    closeHour: 15,
    closeMinute: 30,
    timezone: IDX_TZ,
} as const;

/** Default risk params yang sangat konservatif (PRD OQ-03). */
export const DEFAULT_RISK_PARAMS = {
    stopLossPct: 5,
    takeProfitPct: 10,
    riskPerPositionPct: 1,
    dailyLossLimitPct: 2,
    maxPositions: 5,
} as const;

/** Cooldown dedup sinyal (ms) — mencegah notifikasi ganda. */
export const SIGNAL_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 hari

/** Ticker IDX populer untuk seed watchlist awal. */
export const DEFAULT_WATCHLIST_TICKERS = [
    "BBCA.JK",
    "BBRI.JK",
    "BMRI.JK",
    "TLKM.JK",
    "ASII.JK",
    "GOTO.JK",
    "BYAN.JK",
    "ADRO.JK",
    "ANTM.JK",
    "BBNI.JK",
    "UNTR.JK",
    "ICBP.JK",
] as const;

/** Strategi trading IDX (PRD §10.1 & google-design/prompt.txt) */
export const STRATEGY_CONFIG = {
    BSJP: {
        id: "BSJP",
        name: "BSJP (Beli Sore Jual Pagi)",
        shortName: "BSJP",
        window: "14:30–15:50 WIB",
        channel: "sinyal-bsjp",
        hexColor: "#22D3EE", // cyan
        badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
        description: "Volume spike + foreign net buy mendekati penutupan, candle bullish dekat high",
    },
    BPJS: {
        id: "BPJS",
        name: "BPJS / Day Trade (Beli Pagi Jual Sore)",
        shortName: "BPJS / Day Trade",
        window: "09:00–10:30 WIB",
        channel: "sinyal-bpjs",
        hexColor: "#F59E0B", // amber
        badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        description: "Gap up pembukaan dengan volume tinggi, RSI belum overbought, momentum breakout",
    },
    SWING: {
        id: "SWING",
        name: "Swing / Hold",
        shortName: "Swing / Hold",
        window: "End-of-Day (16:00 WIB)",
        channel: "sinyal-swing",
        hexColor: "#2F81F7", // blue
        badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        description: "Kombinasi EMA cross/MACD + akumulasi foreign multi-hari + sentimen berita netral/positif",
    },
} as const;

/** Channel Notifikasi Discord per PRD §10.2 */
export const DISCORD_CHANNELS = {
    bsjp: "sinyal-bsjp",
    bpjs: "sinyal-bpjs",
    swing: "sinyal-swing",
    news: "news",
} as const;

/** Discord embed colors. */
export const EMBED_COLORS = {
    buy: 0x22c55e, // hijau
    sell: 0xef4444, // merah
    watch: 0xf59e0b, // kuning
    info: 0x3b82f6, // biru
    error: 0xdc2626, // merah gelap
    system: 0x8b5cf6, // ungu
    bsjp: 0x22d3ee, // cyan
    bpjs: 0xf59e0b, // amber
    swing: 0x2f81f7, // blue
} as const;

/** Nama-nama job scheduler. */
export const JOB_NAMES = {
    eodPipeline: "eod-pipeline",
    quoteRefresh: "quote-refresh",
    morningBpjs: "morning-bpjs",
    afternoonBsjp: "afternoon-bsjp",
    swingEod: "swing-eod",
    corporateActionAlerts: "corporate-actions-alerts",
    newsAggregation: "news-aggregation",
    dailyReport: "daily-report",
    healthcheck: "healthcheck",
    mlRetrain: "ml-retrain",
} as const;