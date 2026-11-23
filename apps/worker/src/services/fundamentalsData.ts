/**
 * Fundamental & profil emiten (PRD §4.1/§7).
 *
 * Tabel `fundamental_snapshots` sudah lama dibaca dashboard & screener, tetapi
 * belum ada yang mengisinya. Pipeline ini menutup celah tersebut memakai Yahoo
 * Finance (`quoteSummary`) yang sudah menjadi provider harga default — jadi
 * tidak perlu API key/berbayar.
 *
 * Selain fundamental, pipeline ini juga memperbarui nama perusahaan dan sektor
 * di tabel `stocks`. Tanpa itu semua saham bernama ticker dan alokasi sektor
 * portfolio selalu "Lainnya".
 */

import yahooFinance from "yahoo-finance2";
import type { PrismaClient } from "@stock-analyst/db";
import { logger } from "../logger";

export interface FundamentalData {
    name?: string | null;
    sector?: string | null;
    per?: number | null;
    pbv?: number | null;
    roe?: number | null;
    eps?: number | null;
    revenue?: number | null;
    netIncome?: number | null;
    divYield?: number | null;
    marketCap?: number | null;
    source: string;
    confidence: number;
}

export interface FundamentalsProvider {
    name: string;
    getFundamentals(ticker: string): Promise<FundamentalData | null>;
}

// ---------- Util angka (Yahoo bisa mengembalikan number atau { raw }) ----------

export function toNumberOrNull(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (value && typeof value === "object" && "raw" in value) {
        return toNumberOrNull((value as { raw?: unknown }).raw);
    }
    return null;
}

/**
 * Yahoo mengembalikan rasio (0.18) untuk ROE, sedangkan dashboard
 * menampilkan satuan persen (18%). Nilai yang sudah > 1 dianggap persen.
 */
export function normalizePercent(value: number | null): number | null {
    if (value == null) return null;
    return Number((value <= 1 ? value * 100 : value).toFixed(2));
}

/** PER/PBV kadang negatif (perusahaan merugi) — tetap disimpan apa adanya. */
function normalizeRatio(value: number | null): number | null {
    return value == null ? null : Number(value.toFixed(2));
}

// ---------- Provider Yahoo ----------

interface QuoteSummaryShape {
    price?: Record<string, unknown>;
    summaryDetail?: Record<string, unknown>;
    defaultKeyStatistics?: Record<string, unknown>;
    financialData?: Record<string, unknown>;
    assetProfile?: Record<string, unknown>;
}

export class YahooFundamentalsProvider implements FundamentalsProvider {
    readonly name = "yahoo";

    /**
     * Fallback ringan bila `quoteSummary` kena rate limit. Endpoint `quote`
     * menyediakan PER/PBV/EPS/market cap/dividend yield, tetapi bukan ROE.
     */
    private async fromQuote(ticker: string): Promise<FundamentalData | null> {
        const quote = (await yahooFinance.quote(ticker)) as unknown as Record<string, unknown>;
        const price = toNumberOrNull(quote.regularMarketPrice);
        const eps = toNumberOrNull(quote.epsTrailingTwelveMonths);
        const per = toNumberOrNull(quote.trailingPE) ?? (eps != null && eps > 0 && price != null ? price / eps : null);
        const pbv = toNumberOrNull(quote.priceToBook);
        const name = (typeof quote.longName === "string" && quote.longName) || (typeof quote.shortName === "string" && quote.shortName) || null;
        const sector = typeof quote.sector === "string" ? quote.sector : null;

        if (per == null && pbv == null && name == null) return null;

        return {
            name,
            sector,
            per: normalizeRatio(per),
            pbv: normalizeRatio(pbv),
            roe: null,
            eps: normalizeRatio(eps),
            revenue: null,
            netIncome: null,
            divYield: normalizeRatio(toNumberOrNull(quote.dividendYield)),
            marketCap: toNumberOrNull(quote.marketCap),
            source: `${this.name}:quote`,
            confidence: 0.5,
        };
    }

    async getFundamentals(ticker: string): Promise<FundamentalData | null> {
        let result: QuoteSummaryShape;
        try {
            result = (await yahooFinance.quoteSummary(ticker, {
                modules: ["price", "summaryDetail", "defaultKeyStatistics", "financialData", "assetProfile"],
            })) as unknown as QuoteSummaryShape;
        } catch (err) {
            logger.warn({ err, ticker }, "quoteSummary gagal — fallback ke endpoint quote");
            return this.fromQuote(ticker);
        }

        const price = result.price ?? {};
        const summary = result.summaryDetail ?? {};
        const keyStats = result.defaultKeyStatistics ?? {};
        const financial = result.financialData ?? {};
        const profile = result.assetProfile ?? {};

        const marketCap = toNumberOrNull(price.marketCap) ?? toNumberOrNull(summary.marketCap);
        const eps = toNumberOrNull(keyStats.trailingEps);
        const trailingPe = toNumberOrNull(summary.trailingPE);
        const priceValue = toNumberOrNull(price.regularMarketPrice);
        const per = trailingPe ?? (eps != null && eps > 0 && priceValue != null ? priceValue / eps : null);
        const pbv = toNumberOrNull(keyStats.priceToBook);
        const roe = normalizePercent(toNumberOrNull(financial.returnOnEquity));

        // dividendRate / harga lebih pasti daripada field dividendYield yang
        // formatnya berbeda antar endpoint Yahoo.
        const dividendRate = toNumberOrNull(summary.dividendRate);
        const divYield =
            dividendRate != null && priceValue != null && priceValue > 0
                ? Number(((dividendRate / priceValue) * 100).toFixed(2))
                : // `dividendYield` di summaryDetail sudah dalam persen (mis. 2.5),
                  // berbeda dari ROE yang berupa fraksi.
                  normalizeRatio(toNumberOrNull(summary.dividendYield));

        const name =
            (typeof price.longName === "string" && price.longName) ||
            (typeof price.shortName === "string" && price.shortName) ||
            null;
        const sector = typeof profile.sector === "string" ? profile.sector : null;

        const populated = [per, pbv, roe, eps, marketCap].filter((value) => value != null).length;
        if (populated === 0 && !name) return null;

        return {
            name,
            sector,
            per: normalizeRatio(per),
            pbv: normalizeRatio(pbv),
            roe,
            eps: normalizeRatio(eps),
            revenue: toNumberOrNull(financial.totalRevenue),
            netIncome: toNumberOrNull(financial.netIncomeToCommon),
            divYield: normalizeRatio(divYield),
            marketCap: toNumberOrNull(price.marketCap) ?? marketCap,
            source: this.name,
            confidence: populated >= 3 ? 0.8 : 0.5,
        };
    }
}

export const fundamentalsProvider: FundamentalsProvider = new YahooFundamentalsProvider();

// ---------- Penyimpanan ----------

/** Tanggal snapshot disimpan sebagai tengah malam UTC (konsisten dengan PriceBar). */
export function fundamentalDate(now = new Date()): Date {
    return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export interface FundamentalSyncResult {
    ticker: string;
    saved: boolean;
    profileUpdated: boolean;
}

/** Simpan satu snapshot fundamental + perbarui profil saham. */
export async function syncFundamentalsForStock(
    prisma: PrismaClient,
    stock: { id: string; ticker: string; yahooSymbol: string },
    provider: FundamentalsProvider = fundamentalsProvider,
): Promise<FundamentalSyncResult> {
    const data = await provider.getFundamentals(stock.yahooSymbol);
    if (!data) return { ticker: stock.ticker, saved: false, profileUpdated: false };

    let profileUpdated = false;
    const profile: { name?: string; sector?: string } = {};
    if (data.name && data.name !== stock.ticker) profile.name = data.name;
    if (data.sector) profile.sector = data.sector;
    if (Object.keys(profile).length > 0) {
        await prisma.stock.update({ where: { id: stock.id }, data: profile });
        profileUpdated = true;
    }

    const asOfDate = fundamentalDate();
    const payload = {
        per: data.per,
        pbv: data.pbv,
        roe: data.roe,
        eps: data.eps,
        revenue: data.revenue,
        netIncome: data.netIncome,
        divYield: data.divYield,
        marketCap: data.marketCap,
        source: data.source,
        confidence: data.confidence,
    };

    await prisma.fundamentalSnapshot.upsert({
        where: { stockId_asOfDate: { stockId: stock.id, asOfDate } },
        create: { stockId: stock.id, asOfDate, ...payload },
        update: payload,
    });

    return { ticker: stock.ticker, saved: true, profileUpdated };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sinkronkan fundamental + profil untuk semua saham aktif. */
export async function runFundamentalsSyncPipeline(
    prisma: PrismaClient,
    stocks: Array<{ id: string; ticker: string; yahooSymbol: string }>,
    provider: FundamentalsProvider = fundamentalsProvider,
): Promise<FundamentalSyncResult[]> {
    const results: FundamentalSyncResult[] = [];

    for (const [index, stock] of stocks.entries()) {
        let saved = false;
        for (let attempt = 1; attempt <= 2 && !saved; attempt++) {
            try {
                results.push(await syncFundamentalsForStock(prisma, stock, provider));
                saved = true;
            } catch (err) {
                if (attempt === 2) {
                    logger.error({ err, ticker: stock.ticker }, "gagal sinkronisasi fundamental");
                } else {
                    logger.warn({ err, ticker: stock.ticker }, "fundamental gagal, mencoba ulang");
                    await sleep(1_200);
                }
            }
        }
        // Beri jeda antar saham supaya tidak memicu rate limit Yahoo.
        if (index < stocks.length - 1) await sleep(350);
    }

    const saved = results.filter((result) => result.saved).length;
    const profiles = results.filter((result) => result.profileUpdated).length;
    logger.info({ stocks: stocks.length, saved, profiles, provider: provider.name }, "sinkronisasi fundamental selesai");
    return results;
}
