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

export function formatNumber(value: number): string {
    return new Intl.NumberFormat("id-ID").format(value);
}

export function formatBillion(value: number): string {
    if (Math.abs(value) >= 1_000_000_000_000) {
        return `Rp ${(value / 1_000_000_000_000).toFixed(2)} T`;
    }
    if (Math.abs(value) >= 1_000_000_000) {
        return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
    }
    if (Math.abs(value) >= 1_000_000) {
        return `Rp ${(value / 1_000_000).toFixed(1)} Jt`;
    }
    return formatIDR(value);
}

export function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(" ");
}