"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Table, Badge } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import type { Quote } from "@/lib/data";
import { formatIDR } from "@/lib/format";

const FILTERS = [
  { key: "per", label: "PER", options: ["< 10", "< 15", "< 20"] },
  { key: "pbv", label: "PBV", options: ["< 1", "< 1.5", "< 2"] },
  { key: "roe", label: "ROE", options: ["> 10%", "> 15%", "> 20%"] },
  { key: "rsi", label: "RSI", options: ["Oversold < 30", "Netral 30-70", "Overbought > 70"] },
  { key: "divYield", label: "Dividend Yield", options: ["> 2%", "> 4%", "> 6%"] },
] as const;

type ActiveFilters = Partial<Record<(typeof FILTERS)[number]["key"], string>>;

/** Batas atas untuk filter bertanda "< N" / "< N%". */
function matchesLessThan(value: number, option: string): boolean {
    const limit = Number(option.replace(/[^0-9.]/g, ""));
    return Number.isFinite(limit) && value > 0 && value < limit;
}

function matchesGreaterThan(value: number, option: string): boolean {
    const limit = Number(option.replace(/[^0-9.]/g, ""));
    return Number.isFinite(limit) && value > limit;
}

function matchesRsi(rsi: number, option: string): boolean {
    if (option.startsWith("Oversold")) return rsi < 30;
    if (option.startsWith("Overbought")) return rsi > 70;
    return rsi >= 30 && rsi <= 70;
}

function matches(quote: Quote, active: ActiveFilters): boolean {
    return FILTERS.every((f) => {
        const option = active[f.key];
        if (!option) return true;
        switch (f.key) {
            case "per":
                return matchesLessThan(quote.per, option);
            case "pbv":
                return matchesLessThan(quote.pbv, option);
            case "roe":
                return matchesGreaterThan(quote.roe, option);
            case "divYield":
                return matchesGreaterThan(quote.divYield, option);
            case "rsi":
                return matchesRsi(quote.rsi, option);
            default:
                return true;
        }
    });
}

export default function ScreenerClient({ quotes }: { quotes: Quote[] }) {
    const [active, setActive] = useState<ActiveFilters>({});

    const results = useMemo(() => quotes.filter((q) => matches(q, active)), [quotes, active]);
    const hasActiveFilter = Object.values(active).some(Boolean);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold">Screener Saham</h1>
                <p className="text-sm text-muted-foreground">
                    Filter saham IDX berdasarkan fundamental &amp; teknikal
                </p>
            </div>

            <Card>
                <CardHeader title="Filter" subtitle="Pilih kriteria — hasil diperbarui otomatis" />
                <div className="flex flex-wrap gap-4">
                    {FILTERS.map((f) => (
                        <div key={f.key} className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">{f.label}</label>
                            <select
                                className="input w-44"
                                value={active[f.key] ?? ""}
                                onChange={(e) => setActive((p) => ({ ...p, [f.key]: e.target.value }))}
                            >
                                <option value="">Semua</option>
                                {f.options.map((o) => (
                                    <option key={o} value={o}>
                                        {o}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div className="flex items-end gap-2">
                        <button className="btn-ghost" onClick={() => setActive({})}>
                            Reset
                        </button>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Hasil Screening"
                    subtitle={`${results.length} saham dari ${quotes.length} dipantau`}
                    action={<Badge tone="info">{results.length} hasil</Badge>}
                />
                {results.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Tidak ada saham yang cocok dengan filter{hasActiveFilter ? " ini" : ""}.
                    </p>
                ) : (
                    <Table headers={["Ticker", "Harga", "Perubahan", "PER", "PBV", "ROE", "RSI", "Sinyal"]}>
                        {results.map((q) => (
                            <tr key={q.ticker}>
                                <td className="px-3 py-2">
                                    <Link href={`/stock/${q.ticker}`} className="font-medium hover:text-primary">
                                        {q.ticker}
                                    </Link>
                                </td>
                                <td className="px-3 py-2">{formatIDR(q.price)}</td>
                                <td className="px-3 py-2"><ChangePct value={q.changePct} /></td>
                                <td className="px-3 py-2">{q.per > 0 ? `${q.per.toFixed(1)}x` : "—"}</td>
                                <td className="px-3 py-2">{q.pbv > 0 ? `${q.pbv.toFixed(1)}x` : "—"}</td>
                                <td className="px-3 py-2">{q.roe !== 0 ? `${q.roe.toFixed(1)}%` : "—"}</td>
                                <td className="px-3 py-2">{q.rsi.toFixed(1)}</td>
                                <td className="px-3 py-2"><SignalBadge direction={q.signal} /></td>
                            </tr>
                        ))}
                    </Table>
                )}
            </Card>
        </div>
    );
}
