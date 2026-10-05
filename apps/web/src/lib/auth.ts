/**
 * Auth sederhana single-user untuk dashboard.
 *
 * Bila `DASHBOARD_PASSWORD` kosong, dashboard terbuka (mode dev) — cocok untuk
 * lokal, TIDAK untuk deploy publik. Bila diisi, semua halaman dilindungi
 * middleware dan cookie sesi berisi hash password (bukan password itu sendiri).
 *
 * Ini bukan pengganti sistem auth penuh (tanpa multi-user, tanpa reset, tanpa
 * rotasi sesi) — cukup untuk mencegah dashboard & aksi tulis dibuka orang lain.
 */

import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "xerastock_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Salt tetap supaya hash cookie tidak bisa dipakai ulang di aplikasi lain. */
const HASH_PREFIX = "xerastock";

export function authConfigured(): boolean {
    return Boolean(process.env.DASHBOARD_PASSWORD);
}

/** Hash sesi dari password — dipakai sebagai nilai cookie. */
export function sessionToken(password: string): string {
    return createHash("sha256").update(`${HASH_PREFIX}:${password}`).digest("hex");
}

export function expectedToken(): string | null {
    const password = process.env.DASHBOARD_PASSWORD;
    return password ? sessionToken(password) : null;
}

/** Perbandingan waktu-konstan supaya tidak bocor lewat timing. */
export function safeEqual(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return timingSafeEqual(bufferA, bufferB);
}

/** true bila sesi valid (atau auth memang tidak diaktifkan). */
export function isAuthenticated(): boolean {
    const expected = expectedToken();
    if (!expected) return true;
    const cookie = cookies().get(SESSION_COOKIE)?.value;
    return cookie ? safeEqual(cookie, expected) : false;
}
