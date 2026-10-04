/** Format angka & tanggal untuk UI. */

export function formatIDR(value: number, compact = false): string {
    if (compact) {
        if (Math.abs(value) >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}M`;
        if (Math.abs(value) >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}jt`;
        if (Math.abs(value) >= 1_000) return `Rp${(value / 1_000).toFixed(1)}rb`;
    }
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value);
}

export function formatPct(value: number): string {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
}

/** Angka besar tanpa mata uang (volume lembar, jumlah transaksi). */
export function formatCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}rb`;
    return value.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

/** Tanggal bursa "YYYY-MM-DD" → "05 Sep 2026". */
export function formatDayString(value: string): string {
    return formatDate(`${value}T00:00:00Z`);
}

export function formatDate(d: Date | string): string {
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(d));
}

export function formatTime(d: Date | string): string {
    return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(d));
}

export function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(" ");
}