"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Table, Badge } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import { MOCK_QUOTES } from "@/lib/mock";
import { formatIDR } from "@/lib/format";

const FILTERS = [
  { key: "per", label: "PER", options: ["< 10", "< 15", "< 20"] },
  { key: "pbv", label: "PBV", options: ["< 1", "< 1.5", "< 2"] },
  { key: "roe", label: "ROE", options: ["> 10%", "> 15%", "> 20%"] },
  { key: "rsi", label: "RSI", options: ["Oversold < 30", "Netral 30-70", "Overbought > 70"] },
  { key: "divYield", label: "Dividend Yield", options: ["> 2%", "> 4%", "> 6%"] },
] as const;

export default function ScreenerPage() {
  const [active, setActive] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Screener Saham</h1>
        <p className="text-sm text-muted-foreground">
          Filter saham IDX berdasarkan fundamental & teknikal
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
            <button className="btn-primary">Simpan Preset</button>
            <button
              className="btn-ghost"
              onClick={() => setActive({})}
            >
              Reset
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Hasil Screening"
          subtitle="8 saham dari watchlist (data contoh)"
          action={<Badge tone="info">8 hasil</Badge>}
        />
        <Table headers={["Ticker", "Harga", "Perubahan", "PER", "PBV", "ROE", "RSI", "Sinyal"]}>
          {MOCK_QUOTES.map((q) => (
            <tr key={q.ticker}>
              <td className="px-3 py-2">
                <Link href={`/stock/${q.ticker}`} className="font-medium hover:text-primary">
                  {q.ticker}
                </Link>
              </td>
              <td className="px-3 py-2">{formatIDR(q.price)}</td>
              <td className="px-3 py-2"><ChangePct value={q.changePct} /></td>
              <td className="px-3 py-2">{(10 + (q.price % 15)).toFixed(1)}x</td>
              <td className="px-3 py-2">{(1 + (q.price % 40) / 10).toFixed(1)}x</td>
              <td className="px-3 py-2">{(8 + (q.price % 18)).toFixed(1)}%</td>
              <td className="px-3 py-2">{q.rsi.toFixed(1)}</td>
              <td className="px-3 py-2"><SignalBadge direction={q.signal} /></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}