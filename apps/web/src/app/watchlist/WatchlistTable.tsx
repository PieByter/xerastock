"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardHeader, Table, Badge } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import { ForeignNet } from "@/components/ForeignNet";
import { formatCompact, formatIDR } from "@/lib/format";
import { addStockAction, removeStockAction } from "@/app/actions";
import type { Quote } from "@/lib/data";

export default function WatchlistTable({ quotes }: { quotes: Quote[] }) {
  const [ticker, setTicker] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) setTicker("");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Kode saham (mis. BBCA)"
            className="input max-w-56"
            onKeyDown={(e) => {
              if (e.key === "Enter" && ticker.trim() && !isPending) run(() => addStockAction(ticker));
            }}
          />
          <button
            className="btn-primary"
            disabled={isPending || !ticker.trim()}
            onClick={() => run(() => addStockAction(ticker))}
          >
            {isPending ? "Menyimpan…" : "+ Tambah Saham"}
          </button>
        </div>
        {notice && (
          <Badge tone={notice.ok ? "success" : "danger"}>
            {notice.message}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader
          title="Watchlist Utama"
          subtitle={`${quotes.length} saham · notifikasi aktif`}
          action={<Badge tone="success">Aktif</Badge>}
        />
        {quotes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Watchlist kosong — tambahkan saham di atas.
          </p>
        ) : (
          <Table headers={["Ticker", "Nama", "Harga", "Perubahan", "Volume", "Net Asing", "RSI", "Sinyal", ""]}>
            {quotes.map((q) => (
              <tr key={q.ticker}>
                <td className="px-3 py-2">
                  <Link href={`/stock/${q.ticker}`} className="font-medium hover:text-primary">
                    {q.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{q.name}</td>
                <td className="px-3 py-2 font-medium">{formatIDR(q.price)}</td>
                <td className="px-3 py-2">
                  <ChangePct value={q.changePct} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatCompact(q.volume)}</td>
                <td className="px-3 py-2 text-right">
                  <ForeignNet value={q.foreignNet1d} />
                </td>
                <td className="px-3 py-2">{q.rsi.toFixed(1)}</td>
                <td className="px-3 py-2">
                  <SignalBadge direction={q.signal} />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/stock/${q.ticker}`} className="text-xs text-primary hover:underline">
                      Detail
                    </Link>
                    <button
                      className="text-xs text-danger hover:underline disabled:opacity-50"
                      disabled={isPending}
                      title="Hapus dari watchlist (data historis tetap disimpan)"
                      onClick={() => run(() => removeStockAction(q.ticker))}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
