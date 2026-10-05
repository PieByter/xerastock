/**
 * Middleware auth: melindungi seluruh halaman bila `DASHBOARD_PASSWORD` di-set.
 *
 * Catatan: nilai env dibaca saat build (perilaku Next.js untuk middleware),
 * jadi set `DASHBOARD_PASSWORD` sebelum `next build` / build image Docker.
 */

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "xerastock_session";
const PUBLIC_PATHS = ["/login"];

async function sessionToken(password: string): Promise<string> {
    const data = new TextEncoder().encode(`xerastock:${password}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Path diteruskan ke root layout supaya halaman /login tidak ikut memakai
    // sidebar dashboard.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    const proceed = () => NextResponse.next({ request: { headers: requestHeaders } });

    const password = process.env.DASHBOARD_PASSWORD;
    if (!password) return proceed();

    if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
        return proceed();
    }

    const expected = await sessionToken(password);
    const cookie = request.cookies.get(SESSION_COOKIE)?.value;
    if (cookie && cookie === expected) return proceed();

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
