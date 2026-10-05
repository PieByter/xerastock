/**
 * Backtest — menjalankan strategi terhadap data historis (PRD US-11/KPI-4).
 *
 * Server-only: membaca bar dari Postgres dan mengeksekusi `backtest()` milik
 * engine. Tanpa `DATABASE_URL` (atau saat bar belum tersedia), data contoh
 * deterministik dipakai supaya halaman tetap bisa dipakai (mode demo).
 */

import { prisma } from "@stock-analyst/db";
import {
    backtest,
    type BacktestResult,
    type Candle,
} from "@stock-analyst/engine";
import {
    DEFAULT_RISK_PARAMS,
    DEFAULT_STRATEGY_RULES,
    STRATEGY_CONFIG,
    type RuleConfig,
    type StrategyType,
} from "@stock-analyst/shared";
import { getQuotes } from "./data";
import { MOCK_QUOTES, generateMockCandles } from "./mock";

const DB_TIMEOUT_MS = 2500;
const MIN_BARS = 30;

export interface BacktestStrategyOption {
    id: string;
    name: string;
    strategyType: StrategyType;
    /** Default risk dari strategi (fallback konservatif). */
    riskDefaults: { stopLossPct: number; takeProfitPct: number };
}

export interface BacktestTickerOption {
    ticker: string;
    name: string;
}

export interface BacktestOptions {
    strategies: BacktestStrategyOption[];
    tickers: BacktestTickerOption[];
    /** true bila daftar berasal dari data contoh (DB kosong/tidak tersedia). */
    isDemo: boolean;
}

export interface BacktestInput {
    strategyId: string;
    ticker: string;
    bars: number;
    params: {
        initialBalance: number;
        feePct: number;
        slippagePct: number;
        stopLossPct: number;
        takeProfitPct: number;
        positionSizePct: number;
    };
}

export interface BacktestRunMeta {
    strategyName: string;
    ticker: string;
    bars: number;
    /** Epoch ms bar pertama & terakhir yang dipakai. */
    from: number;
    to: number;
    isDemo: boolean;
}

export interface BacktestRunResponse {
    ok: boolean;
    message: string;
    result?: BacktestResult;
    meta?: BacktestRunMeta;
}

let demoNoticeLogged = false;

/** Jalankan query DB; kembalikan null bila DB tidak tersedia (tanpa melempar). */
async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    if (!process.env.DATABASE_URL) {
        if (!demoNoticeLogged) {
            console.warn("[backtest] DATABASE_URL belum di-set — backtest memakai data contoh.");
            demoNoticeLogged = true;
        }
        return null;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`query timeout ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS);
    });
    try {
        return await Promise.race([fn(), timeout]);
    } catch (err) {
        console.warn(`[backtest] ${label} gagal — fallback ke data contoh: ${(err as Error).message}`);
        return null;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/** Opsi form backtest: strategi aktif + daftar saham (fallback demo). */
export async function getBacktestOptions(): Promise<BacktestOptions> {
    const rows = await safe("getBacktestOptions", () =>
        prisma.strategy.findMany({
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
        }),
    );

    if (!rows || rows.length === 0) {
        const strategies = (Object.keys(DEFAULT_STRATEGY_RULES) as StrategyType[]).map((type) => ({
            id: `demo:${type}`,
            name: STRATEGY_CONFIG[type].name,
            strategyType: type,
            riskDefaults: {
                stopLossPct: DEFAULT_RISK_PARAMS.stopLossPct,
                takeProfitPct: DEFAULT_RISK_PARAMS.takeProfitPct,
            },
        }));
        const quotes = await getQuotes();
        return {
            strategies,
            tickers: quotes.map((q) => ({ ticker: q.ticker, name: q.name })),
            isDemo: true,
        };
    }

    const stocks = await safe("listStocks", () =>
        prisma.stock.findMany({ where: { isActive: true }, orderBy: { ticker: "asc" }, take: 100 }),
    );

    return {
        strategies: rows.map((s) => {
            const risk = (s.riskParamsJson ?? {}) as Partial<typeof DEFAULT_RISK_PARAMS>;
            return {
                id: s.id,
                name: s.name,
                strategyType: (s.strategyType ?? "SWING") as StrategyType,
                riskDefaults: {
                    stopLossPct: risk.stopLossPct ?? DEFAULT_RISK_PARAMS.stopLossPct,
                    takeProfitPct: risk.takeProfitPct ?? DEFAULT_RISK_PARAMS.takeProfitPct,
                },
            };
        }),
        tickers: (stocks ?? []).map((s) => ({ ticker: s.ticker, name: s.name })),
        isDemo: false,
    };
}

/** Candle contoh deterministik per ticker (dipakai bila DB kosong). */
function demoCandles(ticker: string, bars: number): Candle[] {
    const idx = MOCK_QUOTES.findIndex((q) => q.ticker === ticker);
    const base = idx >= 0 ? MOCK_QUOTES[idx]!.price : 5000;
    return generateMockCandles(base, bars, Math.abs(idx) + 1).map((c) => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        timestamp: Date.parse(`${c.time}T00:00:00Z`),
    }));
}

/** Muat bar historis dari DB (ascending) untuk satu ticker. */
async function loadCandles(ticker: string, bars: number): Promise<Candle[] | null> {
    return safe("loadCandles", async () => {
        const stock = await prisma.stock.findUnique({ where: { ticker } });
        if (!stock) return [];
        const rows = await prisma.priceBar.findMany({
            where: { stockId: stock.id },
            orderBy: { timestamp: "desc" },
            take: bars,
        });
        return [...rows].reverse().map((b) => ({
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
            volume: Number(b.volume),
            timestamp: b.timestamp.getTime(),
        }));
    });
}

function validate(input: BacktestInput): string | null {
    const { params } = input;
    const numbers = Object.values(params);
    if (numbers.some((v) => !Number.isFinite(v) || v < 0)) {
        return "Semua parameter harus angka ≥ 0.";
    }
    if (params.initialBalance <= 0) return "Saldo awal harus lebih dari 0.";
    if (params.stopLossPct <= 0 || params.takeProfitPct <= 0) {
        return "Stop loss & take profit harus lebih dari 0%.";
    }
    if (params.positionSizePct <= 0 || params.positionSizePct > 100) {
        return "Ukuran posisi harus di antara 0-100%.";
    }
    if (!input.ticker.trim()) return "Pilih saham terlebih dahulu.";
    return null;
}

/** Jalankan backtest satu strategi untuk satu ticker. */
export async function runBacktest(input: BacktestInput): Promise<BacktestRunResponse> {
    const invalid = validate(input);
    if (invalid) return { ok: false, message: invalid };

    const bars = Math.min(1000, Math.max(60, Math.floor(input.bars) || 260));
    const ticker = input.ticker.trim().toUpperCase();

    // 1) Resolve rules: strategi demo (shared) atau strategi DB.
    let rules: { entry: RuleConfig[]; exit: RuleConfig[] };
    let strategyName: string;
    let strategyIsDemo = false;

    if (input.strategyId.startsWith("demo:")) {
        const type = input.strategyId.slice("demo:".length) as StrategyType;
        if (!DEFAULT_STRATEGY_RULES[type]) {
            return { ok: false, message: `Strategi demo "${type}" tidak dikenal.` };
        }
        rules = DEFAULT_STRATEGY_RULES[type];
        strategyName = STRATEGY_CONFIG[type].name;
        strategyIsDemo = true;
    } else {
        const strategy = await safe("findStrategy", () =>
            prisma.strategy.findUnique({ where: { id: input.strategyId } }),
        );
        if (!strategy) {
            return { ok: false, message: "Strategi tidak ditemukan di database — muat ulang halaman." };
        }
        rules = {
            entry: strategy.entryRulesJson as unknown as RuleConfig[],
            exit: strategy.exitRulesJson as unknown as RuleConfig[],
        };
        strategyName = strategy.name;
    }

    // 2) Resolve candles: DB dulu; fallback data contoh saat kosong.
    const dbCandles = await loadCandles(ticker, bars);
    let candles: Candle[];
    let isDemo: boolean;

    if (dbCandles && dbCandles.length >= MIN_BARS) {
        candles = dbCandles;
        isDemo = false;
    } else {
        candles = demoCandles(ticker, bars);
        isDemo = true;
    }

    if (candles.length < MIN_BARS) {
        return {
            ok: false,
            message: `Data historis ${ticker} belum cukup (${candles.length} bar, minimal ${MIN_BARS}).`,
        };
    }

    // 3) Eksekusi backtest (next-bar, anti-look-ahead) & kembalikan hasil.
    const result = backtest(candles, rules.entry, rules.exit, input.params);
    const from = candles[0]!.timestamp ?? 0;
    const to = candles[candles.length - 1]!.timestamp ?? 0;

    return {
        ok: true,
        message: isDemo
            ? `Backtest ${ticker} memakai data contoh (DB kosong) — hasil ilustrasi.`
            : `Backtest ${ticker} selesai: ${candles.length} bar historis.`,
        result,
        meta: { strategyName, ticker, bars: candles.length, from, to, isDemo: isDemo || strategyIsDemo },
    };
}
