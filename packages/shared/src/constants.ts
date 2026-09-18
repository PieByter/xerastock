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
] as const;

/** Discord embed colors. */
export const EMBED_COLORS = {
    buy: 0x22c55e, // hijau
    sell: 0xef4444, // merah
    watch: 0xf59e0b, // kuning
    info: 0x3b82f6, // biru
    error: 0xdc2626, // merah gelap
    system: 0x8b5cf6, // ungu
} as const;

/** Nama-nama job scheduler. */
export const JOB_NAMES = {
    eodPipeline: "eod-pipeline",
    quoteRefresh: "quote-refresh",
    dailyReport: "daily-report",
    healthcheck: "healthcheck",
    mlRetrain: "ml-retrain",
} as const;