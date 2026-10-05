/**
 * Market Data Service — provider abstraction (PRD FR-DATA-001).
 * Primary: Yahoo Finance (yahoo-finance2). Fallback: Twelve Data (opsional).
 * Semua provider mengembalikan bentuk data yang sama.
 */

import yahooFinance from "yahoo-finance2";
import { env } from "../config";
import { logger } from "../logger";

export interface ProviderBar {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    adjClose: number;
    volume: number;
}

export interface ProviderQuote {
    ticker: string;
    price: number;
    changePct: number;
    volume: number;
}

export interface MarketDataProvider {
    name: string;
    /** Ambil riwayat OHLCV harian. */
    getHistory(ticker: string, days: number): Promise<ProviderBar[]>;
    /** Ambil quote terkini. */
    getQuote(ticker: string): Promise<ProviderQuote>;
}

class YahooProvider implements MarketDataProvider {
    name = "yahoo";

    async getHistory(ticker: string, days: number): Promise<ProviderBar[]> {
        const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const result = await yahooFinance.historical(ticker, {
            period1,
            interval: "1d",
        });

        return result.map((r) => ({
            timestamp: r.date,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
            adjClose: r.adjClose ?? r.close,
            volume: r.volume,
        }));
    }

    async getQuote(ticker: string): Promise<ProviderQuote> {
        const q = await yahooFinance.quote(ticker);
        const price = q.regularMarketPrice ?? 0;
        const prev = q.regularMarketPreviousClose ?? price;
        return {
            ticker,
            price,
            changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
            volume: q.regularMarketVolume ?? 0,
        };
    }
}

/** Twelve Data memakai format simbol berbeda untuk bursa Indonesia (BBCA.JK → BBCA:IDX). */
export function toTwelveDataSymbol(ticker: string): string {
    const upper = ticker.toUpperCase();
    return upper.endsWith(".JK") ? `${upper.slice(0, -3)}:IDX` : upper;
}

interface TwelveDataTimeSeriesResponse {
    status?: string;
    message?: string;
    values?: Array<{
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume?: string;
    }>;
}

interface TwelveDataQuoteResponse {
    status?: string;
    message?: string;
    close?: string;
    previous_close?: string;
    volume?: string;
}

/** Fallback provider berbayar (PRD 10.3) — aktif hanya bila TWELVE_DATA_API_KEY di-set. */
class TwelveDataProvider implements MarketDataProvider {
    name = "twelvedata";

    constructor(private readonly apiKey: string, private readonly baseUrl = "https://api.twelvedata.com") { }

    async getHistory(ticker: string, days: number): Promise<ProviderBar[]> {
        const url = new URL(`${this.baseUrl}/time_series`);
        url.searchParams.set("symbol", toTwelveDataSymbol(ticker));
        url.searchParams.set("interval", "1day");
        url.searchParams.set("outputsize", String(days));
        url.searchParams.set("apikey", this.apiKey);

        const res = await fetch(url);
        const json = (await res.json()) as TwelveDataTimeSeriesResponse;
        if (!res.ok || json.status === "error" || !json.values?.length) {
            throw new Error(`Twelve Data time_series gagal: ${json.message ?? res.statusText}`);
        }

        return json.values
            .map((v) => ({
                timestamp: new Date(`${v.datetime}T00:00:00Z`),
                open: Number(v.open),
                high: Number(v.high),
                low: Number(v.low),
                close: Number(v.close),
                adjClose: Number(v.close),
                volume: Number(v.volume ?? 0),
            }))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    async getQuote(ticker: string): Promise<ProviderQuote> {
        const url = new URL(`${this.baseUrl}/quote`);
        url.searchParams.set("symbol", toTwelveDataSymbol(ticker));
        url.searchParams.set("apikey", this.apiKey);

        const res = await fetch(url);
        const json = (await res.json()) as TwelveDataQuoteResponse;
        if (!res.ok || json.status === "error" || json.close == null) {
            throw new Error(`Twelve Data quote gagal: ${json.message ?? res.statusText}`);
        }

        const price = Number(json.close);
        const prev = Number(json.previous_close ?? json.close);
        return {
            ticker,
            price,
            changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
            volume: Number(json.volume ?? 0),
        };
    }
}

/**
 * Coba provider secara berurutan — pakai hasil pertama yang berhasil.
 * Ini yang bikin provider berbayar "tinggal colok" tanpa ubah service layer (PRD 10.3).
 */
class FallbackProvider implements MarketDataProvider {
    name: string;

    constructor(private readonly providers: MarketDataProvider[]) {
        this.name = providers.map((p) => p.name).join("+");
    }

    getHistory(ticker: string, days: number): Promise<ProviderBar[]> {
        return this.tryAll((p) => p.getHistory(ticker, days));
    }

    getQuote(ticker: string): Promise<ProviderQuote> {
        return this.tryAll((p) => p.getQuote(ticker));
    }

    private async tryAll<T>(fn: (provider: MarketDataProvider) => Promise<T>): Promise<T> {
        const errors: string[] = [];
        for (const provider of this.providers) {
            try {
                return await fn(provider);
            } catch (err) {
                errors.push(`${provider.name}: ${(err as Error).message}`);
                logger.warn({ err, provider: provider.name }, "provider data gagal, coba berikutnya");
            }
        }
        throw new Error(`semua provider data gagal → ${errors.join(" | ")}`);
    }
}

/** Susun rantai provider sesuai env: primary + fallback opsional. */
export function buildProviderChain(): MarketDataProvider[] {
    const yahoo = new YahooProvider();
    const twelve = env.TWELVE_DATA_API_KEY ? new TwelveDataProvider(env.TWELVE_DATA_API_KEY) : null;

    if (env.MARKET_DATA_PROVIDER === "twelvedata" && twelve) return [twelve, yahoo];
    if (twelve) return [yahoo, twelve];
    return [yahoo];
}

/** Provider aktif — bisa ditukar via env/config. */
export const marketData: MarketDataProvider = (() => {
    const chain = buildProviderChain();
    return chain.length === 1 ? chain[0]! : new FallbackProvider(chain);
})();

/** Fetch + simpan riwayat harga ke DB (idempoten, upsert). */
export async function syncHistoryToDb(
    prisma: import("@stock-analyst/db").PrismaClient,
    stockId: string,
    ticker: string,
    days: number,
): Promise<number> {
    const bars = await marketData.getHistory(ticker, days);
    logger.info({ ticker, count: bars.length }, "fetch history");

    let saved = 0;
    for (const bar of bars) {
        await prisma.priceBar.upsert({
            where: {
                stockId_timestamp: { stockId, timestamp: bar.timestamp },
            },
            create: {
                stockId,
                timestamp: bar.timestamp,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                adjClose: bar.adjClose,
                volume: BigInt(Math.round(bar.volume)),
                source: marketData.name,
            },
            update: {
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                adjClose: bar.adjClose,
                volume: BigInt(Math.round(bar.volume)),
            },
        });
        saved++;
    }
    return saved;
}

/** Awal hari bursa (WIB) sebagai tanggal bar intraday. */
export function sessionDate(now = new Date()): Date {
    const wib = new Date(now.toLocaleString("en-US", { timeZone: env.BOT_TIMEZONE }));
    return new Date(Date.UTC(wib.getFullYear(), wib.getMonth(), wib.getDate()));
}

/**
 * Simpan harga terkini sebagai bar hari ini (bar "berjalan").
 *
 * High/low diperluas dari nilai tersimpan, sedangkan open dibiarkan apa adanya
 * supaya bar tetap konsisten saat EOD resmi datang dan menimpanya. Ini yang
 * membuat stop loss / take profit dan alert harga bereaksi intraday, bukan
 * hanya sekali sehari saat data EOD masuk.
 */
export async function saveLiveQuoteToDb(
    prisma: import("@stock-analyst/db").PrismaClient,
    stockId: string,
    quote: ProviderQuote,
): Promise<number | null> {
    if (!Number.isFinite(quote.price) || quote.price <= 0) return null;

    const timestamp = sessionDate();
    const volume = BigInt(Math.max(0, Math.round(quote.volume)));
    const existing = await prisma.priceBar.findUnique({
        where: { stockId_timestamp: { stockId, timestamp } },
    });

    const price = quote.price;
    const high = existing ? Math.max(Number(existing.high), price) : price;
    const low = existing ? Math.min(Number(existing.low), price) : price;

    await prisma.priceBar.upsert({
        where: { stockId_timestamp: { stockId, timestamp } },
        create: {
            stockId,
            timestamp,
            open: price,
            high,
            low,
            close: price,
            adjClose: price,
            volume,
            source: `${marketData.name}:live`,
        },
        update: {
            high,
            low,
            close: price,
            adjClose: price,
            volume: volume > 0n ? volume : undefined,
        },
    });
    return price;
}