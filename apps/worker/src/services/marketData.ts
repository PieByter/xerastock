/**
 * Market Data Service — provider abstraction (PRD FR-DATA-001).
 * Primary: Yahoo Finance (yahoo-finance2). Fallback: Twelve Data (opsional).
 * Semua provider mengembalikan bentuk data yang sama.
 */

import yahooFinance from "yahoo-finance2";
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

// TODO: implementasi TwelveDataProvider sebagai fallback (butuh API key).
// class TwelveDataProvider implements MarketDataProvider { ... }

/** Provider aktif — bisa ditukar via env/config. */
export const marketData: MarketDataProvider = new YahooProvider();

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