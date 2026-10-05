"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, Table, Badge } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import type { Quote, ScreenerPresetView } from "@/lib/data";
import { formatIDR } from "@/lib/format";
import { matchesScreenerFilters, type ScreenerRow } from "@stock-analyst/engine";
import type { ScreenerFilter } from "@stock-analyst/shared";
import { deleteScreenerPresetAction, saveScreenerPresetAction } from "@/app/actions";

type FieldKey = "per" | "pbv" | "roe" | "divYield" | "rsi";

interface FilterOption {
    label: string;
    filter: ScreenerFilter;
}

interface FieldDef {
    key: FieldKey;
    label: string;
    options: FilterOption[];
}

/** Filter kanonik per pilihan dropdown — dipakai saat menyaring & menyimpan preset. */
const FIELD_DEFS: FieldDef[] = [
    {
        key: "per",
        label: "PER",
        options: [
            { label: "< 10", filter: { field: "per", operator: "lt", value: 10 } },
            { label: "< 15", filter: { field: "per", operator: "lt", value: 15 } },
            { label: "< 20", filter: { field: "per", operator: "lt", value: 20 } },
        ],
    },
    {
        key: "pbv",
        label: "PBV",
        options: [
            { label: "< 1", filter: { field: "pbv", operator: "lt", value: 1 } },
            { label: "< 1.5", filter: { field: "pbv", operator: "lt", value: 1.5 } },
            { label: "< 2", filter: { field: "pbv", operator: "lt", value: 2 } },
        ],
    },
    {
        key: "roe",
        label: "ROE",
        options: [
            { label: "> 10%", filter: { field: "roe", operator: "gt", value: 10 } },
            { label: "> 15%", filter: { field: "roe", operator: "gt", value: 15 } },
            { label: "> 20%", filter: { field: "roe", operator: "gt", value: 20 } },
        ],
    },
    {
        key: "rsi",
        label: "RSI",
        options: [
            { label: "Oversold < 30", filter: { field: "rsi14", operator: "lt", value: 30 } },
            { label: "Netral 30-70", filter: { field: "rsi14", operator: "between", value: [30, 70] } },
            { label: "Overbought > 70", filter: { field: "rsi14", operator: "gt", value: 70 } },
        ],
    },
    {
        key: "divYield",
        label: "Dividend Yield",
        options: [
            { label: "> 2%", filter: { field: "divYield", operator: "gt", value: 2 } },
            { label: "> 4%", filter: { field: "divYield", operator: "gt", value: 4 } },
            { label: "> 6%", filter: { field: "divYield", operator: "gt", value: 6 } },
        ],
    },
];

const FILTER_FIELD: Record<FieldKey, ScreenerFilter["field"]> = {
    per: "per",
    pbv: "pbv",
    roe: "roe",
    divYield: "divYield",
    rsi: "rsi14",
};

function sameFilter(a: ScreenerFilter, b: ScreenerFilter): boolean {
    if (a.field !== b.field || a.operator !== b.operator) return false;
    if (Array.isArray(a.value) || Array.isArray(b.value)) {
        return (
            Array.isArray(a.value) &&
            Array.isArray(b.value) &&
            a.value[0] === b.value[0] &&
            a.value[1] === b.value[1]
        );
    }
    return a.value === b.value;
}

function screenerRow(quote: Quote): ScreenerRow {
    return {
        per: quote.per,
        pbv: quote.pbv,
        roe: quote.roe,
        divYield: quote.divYield,
        rsi14: quote.rsi,
    };
}

export default function ScreenerClient({
    quotes,
    presets,
}: {
    quotes: Quote[];
    presets: ScreenerPresetView[];
}) {
    const [active, setActive] = useState<ScreenerFilter[]>([]);
    const [presetId, setPresetId] = useState("");
    const [presetName, setPresetName] = useState("");
    const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const results = useMemo(
        () => quotes.filter((q) => matchesScreenerFilters(screenerRow(q), active)),
        [quotes, active],
    );
    const hasActiveFilter = active.length > 0;
    const selectedPreset = presets.find((p) => p.id === presetId) ?? null;

    const run = (action: () => Promise<{ ok: boolean; message: string }>) => {
        startTransition(async () => {
            const result = await action();
            setNotice(result);
            if (result.ok) router.refresh();
        });
    };

    /** Ganti filter milik satu field (satu field = maksimal satu filter). */
    const setFieldFilter = (key: FieldKey, filter: ScreenerFilter | null) => {
        setActive((prev) => {
            const rest = prev.filter((f) => f.field !== FILTER_FIELD[key]);
            return filter ? [...rest, filter] : rest;
        });
    };

    const selectedLabelFor = (def: FieldDef): string => {
        const current = active.find((f) => f.field === FILTER_FIELD[def.key]);
        if (!current) return "";
        return def.options.find((o) => sameFilter(o.filter, current))?.label ?? "__custom";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Screener Saham</h1>
                    <p className="text-sm text-muted-foreground">
                        Filter saham IDX berdasarkan fundamental &amp; teknikal
                    </p>
                </div>
                {notice && <Badge tone={notice.ok ? "success" : "danger"}>{notice.message}</Badge>}
            </div>

            <Card>
                <CardHeader title="Filter" subtitle="Pilih kriteria — hasil diperbarui otomatis" />
                <div className="flex flex-wrap gap-4">
                    {FIELD_DEFS.map((def) => {
                        const value = selectedLabelFor(def);
                        return (
                            <div key={def.key} className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">{def.label}</label>
                                <select
                                    className="input w-44"
                                    value={value}
                                    onChange={(e) => {
                                        const option = def.options.find((o) => o.label === e.target.value);
                                        setFieldFilter(def.key, option ? option.filter : null);
                                    }}
                                >
                                    <option value="">Semua</option>
                                    {def.options.map((o) => (
                                        <option key={o.label} value={o.label}>
                                            {o.label}
                                        </option>
                                    ))}
                                    {value === "__custom" && <option value="__custom">Kustom</option>}
                                </select>
                            </div>
                        );
                    })}
                    <div className="flex items-end gap-2">
                        <button
                            className="btn-ghost"
                            disabled={!hasActiveFilter}
                            onClick={() => setActive([])}
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Preset"
                    subtitle="Simpan kombinasi filter — bisa dijalankan lagi dari sini atau /screener di Discord"
                />
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Preset tersimpan</label>
                        <select
                            className="input w-56"
                            value={presetId}
                            onChange={(e) => setPresetId(e.target.value)}
                        >
                            <option value="">— pilih preset —</option>
                            {presets.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="btn-ghost"
                        disabled={!selectedPreset}
                        onClick={() => selectedPreset && setActive(selectedPreset.filters)}
                    >
                        Terapkan
                    </button>
                    <button
                        className="btn-ghost"
                        disabled={!selectedPreset || isPending}
                        onClick={() => {
                            if (!selectedPreset) return;
                            if (!window.confirm(`Hapus preset "${selectedPreset.name}"?`)) return;
                            run(async () => {
                                const result = await deleteScreenerPresetAction(selectedPreset.id);
                                if (result.ok) setPresetId("");
                                return result;
                            });
                        }}
                    >
                        Hapus
                    </button>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">
                            Simpan filter saat ini sebagai
                        </label>
                        <input
                            className="input w-56"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder="mis. Value + Oversold"
                            maxLength={40}
                        />
                    </div>
                    <button
                        className="btn-primary"
                        disabled={isPending || !presetName.trim() || !hasActiveFilter}
                        onClick={() =>
                            run(async () => {
                                const result = await saveScreenerPresetAction(presetName, active);
                                if (result.ok) setPresetName("");
                                return result;
                            })
                        }
                    >
                        {isPending ? "Menyimpan…" : "Simpan Preset"}
                    </button>
                </div>
                {presets.length === 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                        Belum ada preset — pilih filter di atas lalu simpan dengan nama.
                    </p>
                )}
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
