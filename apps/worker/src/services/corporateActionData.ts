/**
 * Corporate Action & Dividen (PRD §4.4).
 *
 * Scheduler sudah lama membaca tabel `CorporateAction` untuk reminder H-3/H-1,
 * tapi tidak ada yang mengisinya. Pipeline ini menutup celah itu:
 * tarik dari endpoint sendiri (`CORPORATE_ACTION_API_URL`) atau pakai data
 * contoh deterministik bila endpoint belum dikonfigurasi.
 *
 * Menambah sumber baru = menambah satu implementasi `CorporateActionProvider`.
 */

import type { PrismaClient } from "@stock-analyst/db";
import { calendarDate } from "./marketCalendar";
import { env } from "../config";
import { logger } from "../logger";

export interface CorporateActionItem {
    ticker: string;
    type: "DIVIDEND" | "RUPS" | "RIGHTS_ISSUE" | "STOCK_SPLIT";
    title: string;
    cumDate: Date;
    exDate: Date;
    recordDate?: Date | null;
    paymentDate?: Date | null;
    detail?: string | null;
}

export interface CorporateActionProvider {
    name: string;
    getActions(ticker: string): Promise<CorporateActionItem[]>;
}

const LIST_KEYS = ["data", "items", "result", "results", "corporateActions", "corporate_actions", "rows"];
const TYPE_KEYS = ["type", "actionType", "action_type", "jenis"];
const TITLE_KEYS = ["title", "name", "subject", "judul"];
const CUM_KEYS = ["cumDate", "cum_date", "cumdate", "cum"];
const EX_KEYS = ["exDate", "ex_date", "exdate", "ex"];
const RECORD_KEYS = ["recordDate", "record_date"];
const PAYMENT_KEYS = ["paymentDate", "payment_date", "payDate"];
const DETAIL_KEYS = ["detail", "description", "note", "keterangan"];
const AMOUNT_KEYS = ["amount", "amountOrRatio", "ratio", "value"];

function pick(source: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (source[key] != null) return source[key];
    }
    return undefined;
}

function asDate(value: unknown): Date | null {
    if (value == null) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function asType(value: unknown): CorporateActionItem["type"] {
    const raw = String(value ?? "").toUpperCase();
    if (raw.includes("RUPS") || raw.includes("MEETING")) return "RUPS";
    if (raw.includes("RIGHT")) return "RIGHTS_ISSUE";
    if (raw.includes("SPLIT")) return "STOCK_SPLIT";
    return "DIVIDEND";
}

/** Normalisasi payload JSON apa pun menjadi daftar corporate action. */
export function normalizeCorporateActions(payload: unknown, fallbackTicker: string): CorporateActionItem[] {
    const root = payload as Record<string, unknown> | unknown[];
    let rows: unknown[] = [];

    if (Array.isArray(root)) {
        rows = root;
    } else if (root && typeof root === "object") {
        for (const key of LIST_KEYS) {
            const candidate = (root as Record<string, unknown>)[key];
            if (Array.isArray(candidate)) {
                rows = candidate;
                break;
            }
        }
    }

    const items: CorporateActionItem[] = [];
    for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const record = row as Record<string, unknown>;

        const cumDate = asDate(pick(record, CUM_KEYS));
        const exDate = asDate(pick(record, EX_KEYS)) ?? cumDate;
        if (!cumDate || !exDate) continue;

        const amount = pick(record, AMOUNT_KEYS);
        const detail = pick(record, DETAIL_KEYS);
        items.push({
            ticker: String(record.ticker ?? record.symbol ?? fallbackTicker).toUpperCase(),
            type: asType(pick(record, TYPE_KEYS)),
            title: String(pick(record, TITLE_KEYS) ?? "Corporate Action"),
            cumDate,
            exDate,
            recordDate: asDate(pick(record, RECORD_KEYS)),
            paymentDate: asDate(pick(record, PAYMENT_KEYS)),
            detail: [detail, amount != null ? `Nilai: ${amount}` : null].filter(Boolean).join(" · ") || null,
        });
    }
    return items;
}

/** Provider HTTP: template URL memuat placeholder {ticker}. */
export function createHttpProvider(urlTemplate: string, apiKey?: string): CorporateActionProvider {
    return {
        name: "http",
        async getActions(ticker: string): Promise<CorporateActionItem[]> {
            const url = urlTemplate.replace("{ticker}", encodeURIComponent(ticker));
            const response = await fetch(url, {
                headers: {
                    accept: "application/json",
                    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
                },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return normalizeCorporateActions(await response.json(), ticker);
        },
    };
}

/**
 * Provider contoh deterministik: tiap saham mendapat satu aksi korporasi
 * dalam beberapa hari ke depan, sehingga reminder H-3/H-1 bisa diuji tanpa
 * sumber data eksternal. Data ini sintetis dan mudah dikenali.
 */
export function createSampleProvider(): CorporateActionProvider {
    return {
        name: "sample",
        async getActions(ticker: string): Promise<CorporateActionItem[]> {
            const seed = [...ticker].reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const daysAhead = 2 + (seed % 5);
            const cumDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
            const exDate = new Date(cumDate.getTime() + 24 * 60 * 60 * 1000);
            const paymentDate = new Date(cumDate.getTime() + 14 * 24 * 60 * 60 * 1000);
            const isMeeting = seed % 4 === 0;

            return [
                {
                    ticker,
                    type: isMeeting ? "RUPS" : "DIVIDEND",
                    title: isMeeting ? "RUPS Tahunan (data contoh)" : "Dividen Tunai (data contoh)",
                    cumDate,
                    exDate,
                    recordDate: exDate,
                    paymentDate,
                    detail: isMeeting
                        ? "Agenda tahunan — sumber data contoh, bukan jadwal resmi."
                        : `Rp ${50 + (seed % 200)} / saham — sumber data contoh, bukan jadwal resmi.`,
                },
            ];
        },
    };
}

// ---------- Provider: kalender resmi IDX (gratis, tanpa key) ----------

interface IdxCalendarEvent {
    id?: number;
    title?: string;
    description?: string;
    location?: string;
    start?: string;
    Jenis?: string;
    Step?: string;
}

interface IdxCalendarResponse {
    Results?: IdxCalendarEvent[];
}

const IDX_PRIMARY_BASE = "https://www.idx.co.id/primary";
const IDX_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function monthKeys(now = new Date(), count = 4): string[] {
    const keys: string[] = [];
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    for (let i = 0; i < count; i++) {
        keys.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}01`);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
}

function eventDate(value: string | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value.slice(0, 10));
    return Number.isNaN(date.getTime()) ? null : date;
}

function classifyIdxEvent(description: string): CorporateActionItem["type"] | null {
    const text = description.toLowerCase();
    if (text.includes("rups")) return "RUPS";
    if (text.includes("hmetd") || text.includes("right issue") || text.includes("rights issue")) return "RIGHTS_ISSUE";
    if (text.includes("split") || text.includes("pemecahan")) return "STOCK_SPLIT";
    if (text.includes("dividen")) return "DIVIDEND";
    return null;
}

function idxMilestone(description: string): "cum" | "ex" | "record" | "payment" | "other" {
    const text = description.toLowerCase();
    if (text.startsWith("tanggal cum") || text.includes(" cum ")) return "cum";
    if (text.startsWith("tanggal ex") || text.includes(" ex ")) return "ex";
    if (text.startsWith("tanggal dps") || text.includes("recording")) return "record";
    if (text.startsWith("tanggal pembayaran") || text.includes("pembayaran")) return "payment";
    return "other";
}

/** Ubah event kalender IDX (satu baris per milestone) menjadi aksi korporasi. */
export function normalizeIdxCalendar(
    events: IdxCalendarEvent[],
    fallbackTicker: string,
): CorporateActionItem[] {
    const ticker = fallbackTicker.toUpperCase().replace(/\.JK$/, "");
    const relevant = events.filter((event) => {
        const title = (event.title ?? "").toUpperCase().replace(/\.JK$/, "");
        return title === ticker;
    });

    const groups = new Map<CorporateActionItem["type"], IdxCalendarEvent[]>();
    for (const event of relevant) {
        const description = event.description ?? event.Jenis ?? event.title ?? "";
        const type = classifyIdxEvent(description);
        if (!type) continue;
        const list = groups.get(type) ?? [];
        list.push(event);
        groups.set(type, list);
    }

    const items: CorporateActionItem[] = [];
    for (const [type, list] of groups) {
        const dated = list
            .map((event) => ({ event, date: eventDate(event.start) }))
            .filter((entry): entry is { event: IdxCalendarEvent; date: Date } => entry.date != null)
            .sort((a, b) => a.date.getTime() - b.date.getTime());
        if (dated.length === 0) continue;

        const cumEvents = dated.filter((entry) => idxMilestone(entry.event.description ?? "") === "cum");
        const exEvents = dated.filter((entry) => idxMilestone(entry.event.description ?? "") === "ex");
        const recordEvents = dated.filter((entry) => idxMilestone(entry.event.description ?? "") === "record");
        const paymentEvents = dated.filter((entry) => idxMilestone(entry.event.description ?? "") === "payment");

        const seeds = cumEvents.length > 0 ? cumEvents : exEvents.length > 0 ? exEvents : dated;
        for (const seed of seeds) {
            const cumDate = seed.date;
            const exDate =
                exEvents.find((entry) => entry.date.getTime() >= cumDate.getTime())?.date ??
                (type === "DIVIDEND" || type === "RIGHTS_ISSUE" ? new Date(cumDate.getTime() + 86_400_000) : cumDate);
            const recordDate =
                recordEvents.find((entry) => entry.date.getTime() >= cumDate.getTime())?.date ?? null;
            const paymentDate =
                paymentEvents.find((entry) => entry.date.getTime() >= cumDate.getTime())?.date ?? null;

            const related = dated.filter(
                (entry) => Math.abs(entry.date.getTime() - cumDate.getTime()) <= 31 * 86_400_000,
            );
            const title =
                seed.event.description?.trim() ||
                `${type === "DIVIDEND" ? "Dividen" : type} ${ticker}`;

            items.push({
                ticker,
                type,
                title,
                cumDate,
                exDate,
                recordDate,
                paymentDate,
                detail: [...new Set(related.map((entry) => entry.event.description?.trim()).filter(Boolean))].join(" · ") || null,
            });
        }
    }

    // Dedup dalam satu respons (kalender bisa memuat beberapa milestone).
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = `${item.ticker}-${item.type}-${item.cumDate.toISOString().slice(0, 10)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Provider kalender resmi IDX (`/primary/Home/GetCalendar`). Endpoint publik
 * ini tidak butuh API key, tetapi berada di belakang Cloudflare — bila
 * diblokir, provider fallback (http/sample) tetap dipakai.
 */
export function createIdxProvider(fetchImpl: typeof globalThis.fetch = globalThis.fetch): CorporateActionProvider {
    const cache = new Map<string, IdxCalendarEvent[]>();

    async function loadMonth(month: string): Promise<IdxCalendarEvent[]> {
        const cached = cache.get(month);
        if (cached) return cached;

        const url = `${IDX_PRIMARY_BASE}/Home/GetCalendar?range=m&date=${month}`;
        const res = await fetchImpl(url, {
            headers: {
                accept: "application/json, text/plain, */*",
                "user-agent": IDX_USER_AGENT,
                referer: "https://www.idx.co.id/",
            },
        });
        if (!res.ok) throw new Error(`IDX calendar HTTP ${res.status}`);
        const json = (await res.json()) as IdxCalendarResponse;
        const events = json.Results ?? [];
        cache.set(month, events);
        return events;
    }

    return {
        name: "idx",
        async getActions(ticker: string): Promise<CorporateActionItem[]> {
            const events: IdxCalendarEvent[] = [];
            let loadedMonths = 0;
            const months = monthKeys();
            for (const month of months) {
                try {
                    events.push(...(await loadMonth(month)));
                    loadedMonths++;
                } catch (err) {
                    logger.warn({ err, month }, "kalender IDX bulan ini gagal dimuat");
                }
            }
            // Semua bulan gagal (mis. Cloudflare memblokir) → biarkan fallback
            // provider bekerja. Kalau minimal satu bulan berhasil dimuat,
            // hasil kosong berarti memang tidak ada aksi korporasi.
            if (loadedMonths === 0) throw new Error("kalender IDX tidak dapat diakses");

            const now = Date.now();
            return normalizeIdxCalendar(events, ticker).filter((item) => {
                const time = item.cumDate.getTime();
                return time >= now - 30 * 86_400_000 && time <= now + 180 * 86_400_000;
            });
        },
    };
}

/** Coba provider berurutan; pakai hasil pertama yang berisi data. */
export class FallbackCorporateActionProvider implements CorporateActionProvider {
    readonly name: string;

    constructor(private readonly providers: CorporateActionProvider[]) {
        this.name = providers.map((provider) => provider.name).join("+");
    }

    async getActions(ticker: string): Promise<CorporateActionItem[]> {
        const errors: string[] = [];
        for (const provider of this.providers) {
            try {
                // Provider pertama yang berhasil adalah sumber otoritatif —
                // hasil kosong berarti memang tidak ada aksi korporasi, bukan
                // alasan untuk memakai data contoh.
                return await provider.getActions(ticker);
            } catch (err) {
                errors.push(`${provider.name}: ${(err as Error).message}`);
                logger.warn({ err, provider: provider.name, ticker }, "provider corporate action gagal");
            }
        }
        throw new Error(`semua provider corporate action gagal → ${errors.join(" | ")}`);
    }
}

export function resolveProvider(): CorporateActionProvider {
    const configured = env.CORPORATE_ACTION_PROVIDER;
    const hasUrl = Boolean(env.CORPORATE_ACTION_API_URL);

    if (configured === "sample") return createSampleProvider();
    if (configured === "http") {
        return hasUrl
            ? createHttpProvider(env.CORPORATE_ACTION_API_URL!, env.CORPORATE_ACTION_API_KEY)
            : createSampleProvider();
    }
    if (configured === "idx") return new FallbackCorporateActionProvider([createIdxProvider(), createSampleProvider()]);

    const providers: CorporateActionProvider[] = [createIdxProvider()];
    if (hasUrl) providers.push(createHttpProvider(env.CORPORATE_ACTION_API_URL!, env.CORPORATE_ACTION_API_KEY));
    providers.push(createSampleProvider());
    return new FallbackCorporateActionProvider(providers);
}

export interface CorporateActionSyncResult {
    fetched: number;
    saved: number;
    source: string;
}

/** Tarik aksi korporasi untuk semua saham aktif lalu simpan (idempoten). */
export async function runCorporateActionSyncPipeline(
    prisma: PrismaClient,
    stocks: Array<{ id: string; ticker: string }>,
): Promise<CorporateActionSyncResult> {
    const provider = resolveProvider();
    let fetched = 0;
    let saved = 0;

    for (const stock of stocks) {
        try {
            const items = await provider.getActions(stock.ticker);
            fetched += items.length;

            for (const item of items) {
                // Tanggal aksi korporasi adalah tanggal, bukan waktu — normalisasi
                // ke tengah malam WIB supaya pencocokan idempoten (provider yang
                // mengembalikan timestamp berbeda tiap panggilan tidak bikin duplikat).
                const cumDate = calendarDate(item.cumDate);
                const exDate = calendarDate(item.exDate);
                const recordDate = item.recordDate ? calendarDate(item.recordDate) : null;
                const paymentDate = item.paymentDate ? calendarDate(item.paymentDate) : null;

                const existing = await prisma.corporateAction.findFirst({
                    where: { ticker: item.ticker, type: item.type, cumDate },
                });
                if (existing) {
                    await prisma.corporateAction.update({
                        where: { id: existing.id },
                        data: {
                            title: item.title,
                            exDate,
                            recordDate,
                            paymentDate,
                            detail: item.detail ?? null,
                        },
                    });
                    continue;
                }

                await prisma.corporateAction.create({
                    data: {
                        stockId: stock.id,
                        ticker: item.ticker,
                        type: item.type,
                        title: item.title,
                        cumDate,
                        exDate,
                        recordDate,
                        paymentDate,
                        detail: item.detail ?? null,
                    },
                });
                saved++;
            }
        } catch (err) {
            logger.error({ err, ticker: stock.ticker, provider: provider.name }, "gagal ambil corporate action");
        }
    }

    logger.info({ source: provider.name, fetched, saved }, "sinkronisasi corporate action selesai");
    return { fetched, saved, source: provider.name };
}
