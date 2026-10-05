/**
 * Kalender bursa IDX (PRD FR-DATA-005).
 *
 * Sumber kebenaran: tabel `CalendarDay`. Bila tanggal belum ada di tabel,
 * dipakai fallback hari kerja Senin–Jumat. Hari libur nasional bisa diisi
 * lewat env `MARKET_HOLIDAYS` (daftar `YYYY-MM-DD` dipisah koma) atau manual
 * ke tabel — job terjadwal akan melewati hari tersebut.
 */

import type { PrismaClient } from "@stock-analyst/db";
import { env } from "../config";
import { logger } from "../logger";

/** Tanggal (WIB) yang dinormalisasi ke tengah malam UTC — kunci tabel CalendarDay. */
export function calendarDate(now = new Date()): Date {
    const wib = new Date(now.toLocaleString("en-US", { timeZone: env.BOT_TIMEZONE }));
    return new Date(Date.UTC(wib.getFullYear(), wib.getMonth(), wib.getDate()));
}

/** true bila tanggal tersebut hari bursa. */
export async function isTradingDay(prisma: PrismaClient, now = new Date()): Promise<boolean> {
    const date = calendarDate(now);

    const row = await prisma.calendarDay.findUnique({ where: { date } });
    if (row) return row.isTradingDay;

    const day = date.getUTCDay();
    return day >= 1 && day <= 5;
}

/** Sinkronkan daftar libur dari env MARKET_HOLIDAYS ke tabel CalendarDay. */
export async function syncCalendarFromEnv(prisma: PrismaClient): Promise<number> {
    const raw = env.MARKET_HOLIDAYS ?? "";
    const dates = raw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

    if (dates.length === 0) return 0;

    for (const value of dates) {
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(Date.UTC(year!, month! - 1, day!));
        await prisma.calendarDay.upsert({
            where: { date },
            update: { isTradingDay: false, note: "libur dari MARKET_HOLIDAYS" },
            create: { date, isTradingDay: false, note: "libur dari MARKET_HOLIDAYS" },
        });
    }

    logger.info({ count: dates.length }, "kalender bursa disinkronkan dari env");
    return dates.length;
}
