"use server";

/** Server actions untuk login/logout dashboard. */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    SESSION_COOKIE,
    SESSION_MAX_AGE_SECONDS,
    authConfigured,
    expectedToken,
    safeEqual,
    sessionToken,
} from "@/lib/auth";

export interface LoginResult {
    ok: boolean;
    message: string;
}

export async function loginAction(password: string): Promise<LoginResult> {
    if (!authConfigured()) {
        return { ok: false, message: "DASHBOARD_PASSWORD belum di-set — dashboard tidak dikunci." };
    }

    const expected = expectedToken();
    const candidate = sessionToken(password);
    if (!expected || !safeEqual(candidate, expected)) {
        return { ok: false, message: "Password salah." };
    }

    cookies().set(SESSION_COOKIE, candidate, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: "/",
    });
    return { ok: true, message: "Berhasil masuk." };
}

export async function logoutAction(): Promise<void> {
    cookies().delete(SESSION_COOKIE);
    redirect("/login");
}
