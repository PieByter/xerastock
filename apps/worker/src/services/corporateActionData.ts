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

export function resolveProvider(): CorporateActionProvider {
    const configured = env.CORPORATE_ACTION_PROVIDER;
    const hasUrl = Boolean(env.CORPORATE_ACTION_API_URL);

    if (configured === "sample") return createSampleProvider();
    if (configured === "http" && hasUrl) {
        return createHttpProvider(env.CORPORATE_ACTION_API_URL!, env.CORPORATE_ACTION_API_KEY);
    }
    if (configured === "auto" && hasUrl) {
        return createHttpProvider(env.CORPORATE_ACTION_API_URL!, env.CORPORATE_ACTION_API_KEY);
    }
    return createSampleProvider();
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
