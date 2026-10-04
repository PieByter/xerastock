/**
 * Broker Data Service — provider abstraction broker summary & foreign flow (PRD 10.3).
 *
 * Service layer (scheduler, signal engine, API) hanya bicara lewat interface
 * `BrokerSummaryProvider`, jadi sumber data bisa ditukar lewat env
 * `BROKER_PROVIDER` tanpa menyentuh kode dashboard/signal engine:
 *
 * - `sample` → data contoh deterministik (bisa dijalankan tanpa sumber eksternal)
 * - `http`   → endpoint JSON milik sendiri/vendor lewat `BROKER_API_URL`
 * - `auto`   → pakai `http` bila dikonfigurasi, fallback ke `sample`
 *
 * Baris hasil fallback tercatat `source = "sample"` di tabel `broker_summary`,
 * jadi data sintetis selalu bisa dibedakan dari data asli.
 */

import type { PrismaClient } from "@stock-analyst/db";
import {
    generateSampleBrokerRows,
    sumForeignFlow,
    type BrokerRow,
    type ForeignFlowPoint,
    type InvestorType,
} from "@stock-analyst/engine";
import { env } from "../config";
import { logger } from "../logger";

export interface BrokerSummaryData {
    ticker: string;
    /** Tanggal bursa, format YYYY-MM-DD. */
    date: string;
    /** Nilai untuk kolom `source` di tabel `broker_summary` (mis. `scraper`, `sample`). */
    source?: string;
    rows: BrokerRow[];
}

/** Kontrak PRD 10.3 — implementasi apa pun harus memenuhi ini. */
export interface BrokerSummaryProvider {
    name: string;
    getBrokerSummary(ticker: string, date: string): Promise<BrokerSummaryData | null>;
    getForeignFlow(ticker: string, from: string, to: string): Promise<ForeignFlowPoint[]>;
}

// ---------- Util tanggal & angka ----------

/** Tanggal bursa disimpan sebagai tengah malam UTC (lihat schema.prisma). */
export function toUtcMidnight(date: string | Date): Date {
    const value = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
    return new Date(`${value}T00:00:00.000Z`);
}

export function toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
}

/** Daftar hari bursa (Senin–Jumat) berakhir di `endDate`, urut lama → baru. */
export function tradingDates(endDate: string, count: number): string[] {
    const out: string[] = [];
    const cursor = toUtcMidnight(endDate);
    while (out.length < count) {
        const day = cursor.getUTCDay();
        if (day !== 0 && day !== 6) out.push(toDateString(cursor));
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return out.reverse();
}

/** Jumlah hari bursa antara dua tanggal (inklusif). */
export function tradingDaysBetween(from: string, to: string): number {
    let count = 0;
    const cursor = toUtcMidnight(from);
    const last = toUtcMidnight(to);
    while (cursor <= last) {
        const day = cursor.getUTCDay();
        if (day !== 0 && day !== 6) count++;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
}

/**
 * Konversi nilai longgar → number. Menangani format ribuan/desimal Indonesia
 * maupun Inggris ("1.234.567", "1,234,567", "1234.5", "Rp 1.234.567", "(1.234)").
 */
export function toNumber(value: unknown): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "bigint") return Number(value);
    if (typeof value !== "string") return 0;

    const trimmed = value.trim();
    if (!trimmed) return 0;

    const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith("-");
    let digits = trimmed.replace(/[^\d.,]/g, "");
    const lastComma = digits.lastIndexOf(",");
    const lastDot = digits.lastIndexOf(".");

    if (lastComma >= 0 && lastDot >= 0) {
        const decimal = Math.max(lastComma, lastDot);
        digits = `${digits.slice(0, decimal).replace(/[.,]/g, "")}.${digits.slice(decimal + 1).replace(/[.,]/g, "")}`;
    } else {
        const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : "";
        if (separator) {
            const parts = digits.split(separator);
            const tail = parts[parts.length - 1] ?? "";
            // "1.234.567" / "1,234,567" → pemisah ribuan; "1234.5" → desimal.
            digits = parts.length > 2 || tail.length === 3 ? parts.join("") : parts.join(".");
        }
    }

    const parsed = Number(digits);
    if (!Number.isFinite(parsed)) return 0;
    return negative ? -parsed : parsed;
}

// ---------- Normalisasi payload JSON vendor ----------

const LIST_KEYS = ["data", "rows", "brokers", "result", "results", "items", "brokerSummary", "broker_summary"];
const BROKER_CODE_KEYS = ["brokerCode", "broker_code", "broker", "code", "brokerId", "broker_id"];
const DATE_KEYS = ["date", "tradeDate", "trade_date", "tanggal", "timestamp", "time"];
const INVESTOR_KEYS = ["investorType", "investor_type", "investor", "type"];
const BUY_FREQ_KEYS = ["buyFreq", "buy_freq", "buyFrequency", "buy_frequency", "freqBuy"];
const BUY_VOLUME_KEYS = ["buyVolume", "buy_volume", "volumeBuy", "volume_buy", "buyLot", "buy_lot"];
const BUY_VALUE_KEYS = ["buyValue", "buy_value", "valueBuy", "value_buy", "buyAmount", "buy_amount"];
const SELL_FREQ_KEYS = ["sellFreq", "sell_freq", "sellFrequency", "sell_frequency", "freqSell"];
const SELL_VOLUME_KEYS = ["sellVolume", "sell_volume", "volumeSell", "volume_sell", "sellLot", "sell_lot"];
const SELL_VALUE_KEYS = ["sellValue", "sell_value", "valueSell", "value_sell", "sellAmount", "sell_amount"];

function pick(source: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
}

function toText(value: unknown): string {
    return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/** Cari array baris di dalam payload — langsung, atau satu level di dalam objek. */
function extractList(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    const source = payload as Record<string, unknown>;
    for (const key of LIST_KEYS) {
        if (Array.isArray(source[key])) return source[key] as unknown[];
    }
    for (const value of Object.values(source)) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") {
            const nested = extractList(value);
            if (nested.length > 0) return nested;
        }
    }
    return [];
}

export function toInvestorType(value: unknown): InvestorType {
    const raw = toText(value).toUpperCase();
    if (raw.includes("FOREIGN") || raw.includes("ASING") || raw === "F" || raw === "W") return "FOREIGN";
    return "LOCAL";
}

/**
 * Ubah payload JSON vendor apa pun ke `BrokerRow[]`. Nama field longgar karena
 * tiap sumber memakai penamaan berbeda; baris tanpa kode broker dibuang.
 */
export function normalizeBrokerRows(payload: unknown, fallbackDate: string): BrokerRow[] {
    const rows: BrokerRow[] = [];

    for (const item of extractList(payload)) {
        if (!item || typeof item !== "object") continue;
        const source = item as Record<string, unknown>;
        const brokerCode = toText(pick(source, BROKER_CODE_KEYS)).toUpperCase();
        if (!brokerCode) continue;

        const rawDate = toText(pick(source, DATE_KEYS));
        const buyValue = toNumber(pick(source, BUY_VALUE_KEYS));
        const sellValue = toNumber(pick(source, SELL_VALUE_KEYS));

        rows.push({
            date: rawDate ? rawDate.slice(0, 10) : fallbackDate,
            brokerCode,
            investorType: toInvestorType(pick(source, INVESTOR_KEYS)),
            buyFreq: toNumber(pick(source, BUY_FREQ_KEYS)),
            buyVolume: toNumber(pick(source, BUY_VOLUME_KEYS)),
            buyValue,
            sellFreq: toNumber(pick(source, SELL_FREQ_KEYS)),
            sellVolume: toNumber(pick(source, SELL_VOLUME_KEYS)),
            sellValue,
        });
    }

    return rows;
}

// ---------- Provider: HTTP JSON (generik, tanpa ketergantungan vendor) ----------

export interface HttpBrokerProviderOptions {
    /** Template URL dengan placeholder `{ticker}` dan opsional `{date}`. */
    urlTemplate: string;
    apiKey?: string;
    /** Header untuk apiKey (default `Authorization: Bearer <key>`). */
    apiKeyHeader?: string;
    apiKeyScheme?: string;
    timeoutMs?: number;
    fetchImpl?: typeof globalThis.fetch;
}

export class HttpBrokerProvider implements BrokerSummaryProvider {
    readonly name = "http";

    constructor(private readonly options: HttpBrokerProviderOptions) { }

    private get usesDatePlaceholder(): boolean {
        return this.options.urlTemplate.includes("{date}");
    }

    private buildUrl(ticker: string, date: string): string {
        return this.options.urlTemplate
            .replace(/\{ticker\}/g, encodeURIComponent(ticker))
            .replace(/\{date\}/g, encodeURIComponent(date));
    }

    private async request(ticker: string, date: string): Promise<unknown> {
        const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
        const headers: Record<string, string> = { accept: "application/json" };
        if (this.options.apiKey) {
            const header = this.options.apiKeyHeader ?? "Authorization";
            // Default `Authorization: Bearer <key>`; header kustom dikirim apa adanya
            // kecuali apiKeyScheme diisi eksplisit.
            const scheme = this.options.apiKeyScheme ?? (header.toLowerCase() === "authorization" ? "Bearer" : "");
            headers[header] = scheme ? `${scheme} ${this.options.apiKey}` : this.options.apiKey;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
        try {
            const res = await fetchImpl(this.buildUrl(ticker, date), { headers, signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            return await res.json();
        } finally {
            clearTimeout(timeout);
        }
    }

    async getBrokerSummary(ticker: string, date: string): Promise<BrokerSummaryData | null> {
        const target = toDateString(toUtcMidnight(date));
        const rows = normalizeBrokerRows(await this.request(ticker, target), target);
        if (rows.length === 0) return null;
        return { ticker, date: target, source: "scraper", rows };
    }

    /**
     * Bila template tidak punya `{date}`, endpoint dianggap bisa mengembalikan
     * seluruh rentang dalam satu panggilan; kalau ada, diambil per hari bursa.
     */
    async getForeignFlow(ticker: string, from: string, to: string): Promise<ForeignFlowPoint[]> {
        const rows: BrokerRow[] = [];

        if (this.usesDatePlaceholder) {
            for (const date of tradingDates(to, tradingDaysBetween(from, to))) {
                if (date < from) continue;
                rows.push(...normalizeBrokerRows(await this.request(ticker, date), date));
            }
        } else {
            rows.push(...normalizeBrokerRows(await this.request(ticker, to), to));
        }

        return sumForeignFlow(rows).filter((point) => point.date >= from && point.date <= to);
    }
}

// ---------- Provider: data contoh deterministik ----------

export interface BrokerSampleContext {
    /** Harga acuan untuk konversi nilai → volume. */
    avgPrice?: number;
    /** Perkiraan nilai transaksi harian (Rp) untuk skala angka. */
    dailyTurnover?: number;
}

const SAMPLE_WINDOW_DAYS = 60;
const DEFAULT_AVG_PRICE = 1_000;
const DEFAULT_DAILY_TURNOVER = 50_000_000_000;

function seedFromTicker(ticker: string): number {
    let hash = 7;
    for (const char of ticker) hash = (hash * 31 + char.charCodeAt(0)) % 2_147_483_647;
    return hash;
}

/**
 * Data contoh deterministik — dipakai dashboard demo dan sebagai fallback saat
 * endpoint broker belum dikonfigurasi. Nilai transaksi/volume diskalakan lewat
 * `resolveContext` supaya sebanding dengan harga saham aslinya.
 */
export class SampleBrokerProvider implements BrokerSummaryProvider {
    readonly name = "sample";

    constructor(
        private readonly resolveContext: (ticker: string) => BrokerSampleContext | Promise<BrokerSampleContext> = () => ({}),
    ) { }

    private async buildRows(ticker: string, endDate: string, days: number): Promise<BrokerRow[]> {
        const context = await this.resolveContext(ticker);
        return generateSampleBrokerRows({
            dates: tradingDates(endDate, days),
            dailyTurnover: context.dailyTurnover ?? DEFAULT_DAILY_TURNOVER,
            avgPrice: context.avgPrice ?? DEFAULT_AVG_PRICE,
            seed: seedFromTicker(ticker),
        });
    }

    async getBrokerSummary(ticker: string, date: string): Promise<BrokerSummaryData> {
        const target = toDateString(toUtcMidnight(date));
        const rows = await this.buildRows(ticker, target, SAMPLE_WINDOW_DAYS);
        return { ticker, date: target, source: "sample", rows: rows.filter((row) => row.date === target) };
    }

    async getForeignFlow(ticker: string, from: string, to: string): Promise<ForeignFlowPoint[]> {
        const span = Math.max(SAMPLE_WINDOW_DAYS, tradingDaysBetween(from, to) + 5);
        const rows = await this.buildRows(ticker, to, span);
        return sumForeignFlow(rows).filter((point) => point.date >= from && point.date <= to);
    }
}

// ---------- Rantai provider & pemilihan via env ----------

/** Coba provider berurutan — pakai hasil pertama yang berhasil. */
export class FallbackBrokerProvider implements BrokerSummaryProvider {
    readonly name: string;

    constructor(private readonly providers: BrokerSummaryProvider[]) {
        this.name = providers.map((provider) => provider.name).join("+");
    }

    getBrokerSummary(ticker: string, date: string): Promise<BrokerSummaryData | null> {
        return this.tryAll((provider) => provider.getBrokerSummary(ticker, date));
    }

    async getForeignFlow(ticker: string, from: string, to: string): Promise<ForeignFlowPoint[]> {
        return (await this.tryAll((provider) => provider.getForeignFlow(ticker, from, to))) ?? [];
    }

    private async tryAll<T>(fn: (provider: BrokerSummaryProvider) => Promise<T | null>): Promise<T | null> {
        const errors: string[] = [];
        let last: T | null = null;

        for (const provider of this.providers) {
            try {
                const result = await fn(provider);
                if (result !== null && (!Array.isArray(result) || result.length > 0)) return result;
                last = result;
            } catch (err) {
                errors.push(`${provider.name}: ${(err as Error).message}`);
                logger.warn({ err, provider: provider.name }, "provider broker gagal, coba berikutnya");
            }
        }

        if (errors.length === this.providers.length) {
            throw new Error(`semua provider broker gagal → ${errors.join(" | ")}`);
        }
        return last;
    }
}

let cachedHttpProvider: HttpBrokerProvider | null = null;

export function createSampleBrokerProvider(prisma: PrismaClient): SampleBrokerProvider {
    const contexts = new Map<string, BrokerSampleContext>();

    return new SampleBrokerProvider(async (ticker) => {
        const cached = contexts.get(ticker);
        if (cached) return cached;

        const bar = await prisma.priceBar.findFirst({
            where: { stock: { ticker } },
            orderBy: { timestamp: "desc" },
        });
        const context: BrokerSampleContext = bar
            ? { avgPrice: Number(bar.close.toFixed(2)), dailyTurnover: Number(bar.close) * Number(bar.volume) }
            : {};
        contexts.set(ticker, context);
        return context;
    });
}

/** Susun rantai provider sesuai env `BROKER_PROVIDER`. */
export function buildBrokerProviderChain(prisma: PrismaClient): BrokerSummaryProvider[] {
    const sample = createSampleBrokerProvider(prisma);

    if (!env.BROKER_API_URL || env.BROKER_PROVIDER === "sample") {
        if (env.BROKER_PROVIDER === "http") {
            logger.warn("BROKER_PROVIDER=http tapi BROKER_API_URL kosong — memakai provider sample");
        }
        return [sample];
    }

    cachedHttpProvider ??= new HttpBrokerProvider({
        urlTemplate: env.BROKER_API_URL,
        apiKey: env.BROKER_API_KEY,
    });

    return env.BROKER_PROVIDER === "http" ? [cachedHttpProvider] : [cachedHttpProvider, sample];
}

/** Provider aktif — bisa ditukar via env, dipakai service layer. */
let activeProvider: BrokerSummaryProvider | null = null;

export function getBrokerProvider(prisma: PrismaClient): BrokerSummaryProvider {
    if (activeProvider) return activeProvider;
    const chain = buildBrokerProviderChain(prisma);
    activeProvider = chain.length === 1 ? chain[0]! : new FallbackBrokerProvider(chain);
    logger.info({ provider: activeProvider.name }, "broker provider aktif");
    return activeProvider;
}

// ---------- Penulisan ke DB ----------

export interface WriteBrokerResult {
    brokerRows: number;
    foreignFlowBars: number;
}

/**
 * Simpan broker summary satu hari ke DB (idempoten lewat unique
 * `stockId + date + brokerCode`) dan sinkronkan kolom foreign flow di
 * `price_bar` supaya chart foreign flow memakai angka yang sama dengan tabel.
 *
 * Nilai `source` diambil dari provider yang menghasilkan data (`data.source`),
 * jadi baris sintetis tidak pernah tertukar dengan baris dari endpoint asli.
 */
export async function writeBrokerSummary(
    prisma: PrismaClient,
    stockId: string,
    data: BrokerSummaryData,
): Promise<WriteBrokerResult> {
    const date = toUtcMidnight(data.date);
    const source = data.source ?? "unknown";

    for (const row of data.rows) {
        const payload = {
            investorType: row.investorType,
            buyFreq: Math.round(row.buyFreq),
            buyVolume: BigInt(Math.round(row.buyVolume)),
            buyValue: Math.round(row.buyValue),
            sellFreq: Math.round(row.sellFreq),
            sellVolume: BigInt(Math.round(row.sellVolume)),
            sellValue: Math.round(row.sellValue),
            source,
        };

        await prisma.brokerSummary.upsert({
            where: { stockId_date_brokerCode: { stockId, date, brokerCode: row.brokerCode } },
            create: { stockId, date, brokerCode: row.brokerCode, ...payload },
            update: payload,
        });
    }

    let foreignFlowBars = 0;
    for (const point of sumForeignFlow(data.rows)) {
        const timestamp = toUtcMidnight(point.date);
        const updated = await prisma.priceBar.updateMany({
            where: { stockId, timestamp },
            data: {
                foreignBuyValue: Math.round(point.foreignBuy),
                foreignSellValue: Math.round(point.foreignSell),
            },
        });
        foreignFlowBars += updated.count;
    }

    return { brokerRows: data.rows.length, foreignFlowBars };
}

export interface BrokerSyncResult {
    ticker: string;
    provider: string;
    dates: number;
    brokerRows: number;
    foreignFlowBars: number;
}

/** Ambil broker summary untuk beberapa tanggal bursa lalu simpan ke DB. */
export async function syncBrokerSummaryForStock(
    prisma: PrismaClient,
    stock: { id: string; ticker: string; yahooSymbol: string },
    dates: string[],
): Promise<BrokerSyncResult> {
    const provider = getBrokerProvider(prisma);
    const result: BrokerSyncResult = {
        ticker: stock.ticker,
        provider: provider.name,
        dates: dates.length,
        brokerRows: 0,
        foreignFlowBars: 0,
    };

    for (const date of dates) {
        const data = await provider.getBrokerSummary(stock.yahooSymbol, date);
        if (!data || data.rows.length === 0) continue;

        const written = await writeBrokerSummary(prisma, stock.id, data);
        result.brokerRows += written.brokerRows;
        result.foreignFlowBars += written.foreignFlowBars;
    }

    return result;
}

/**
 * Job sinkronisasi broker summary: hari bursa diambil dari `price_bar` supaya
 * tanggalnya pasti tanggal bursa yang datanya sudah ada.
 */
export async function runBrokerSyncPipeline(
    prisma: PrismaClient,
    stocks: { id: string; ticker: string; yahooSymbol: string }[],
    days: number = env.BROKER_SYNC_DAYS,
): Promise<BrokerSyncResult[]> {
    const results: BrokerSyncResult[] = [];

    for (const stock of stocks) {
        try {
            const bars = await prisma.priceBar.findMany({
                where: { stockId: stock.id },
                orderBy: { timestamp: "desc" },
                take: days,
                select: { timestamp: true },
            });
            if (bars.length === 0) continue;

            const dates = bars.map((bar) => toDateString(bar.timestamp)).reverse();
            results.push(await syncBrokerSummaryForStock(prisma, stock, dates));
        } catch (err) {
            logger.error({ err, ticker: stock.ticker }, "gagal sinkronisasi broker summary");
        }
    }

    const totals = results.reduce(
        (acc, item) => ({ brokerRows: acc.brokerRows + item.brokerRows, dates: acc.dates + item.dates }),
        { brokerRows: 0, dates: 0 },
    );
    logger.info({ stocks: results.length, ...totals }, "sinkronisasi broker summary selesai");

    return results;
}
