import Link from "next/link";
import { Card, CardHeader, StatCard, Table, Badge } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import { MOCK_QUOTES, MOCK_SIGNALS } from "@/lib/mock";
import { formatIDR, formatPct, formatTime } from "@/lib/format";

export default function DashboardPage() {
  const gainers = [...MOCK_QUOTES].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
  const losers = [...MOCK_QUOTES].sort((a, b) => a.changePct - b.changePct).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan pasar, watchlist, dan sinyal terbaru — Jumat, 5 September 2026
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saham Dipantau" value="8" sub="2 watchlist aktif" />
        <StatCard label="Sinyal Hari Ini" value="3" sub="2 BUY · 1 SELL" tone="success" />
        <StatCard label="Posisi Terbuka" value="2" sub="Mode PAPER" />
        <StatCard label="Bot Status" value="Running" sub="SIGNAL_ONLY · uptime 99.2%" tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top Gainers"
            subtitle="Perubahan harga terbesar hari ini"
            action={<Link href="/watchlist" className="text-xs text-primary hover:underline">Lihat semua →</Link>}
          />
          <Table headers={["Ticker", "Harga", "Perubahan", "RSI", "Sinyal"]}>
            {gainers.map((q) => (
              <tr key={q.ticker}>
                <td className="px-3 py-2">
                  <Link href={`/stock/${q.ticker}`} className="font-medium hover:text-primary">
                    {q.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2">{formatIDR(q.price)}</td>
                <td className="px-3 py-2"><ChangePct value={q.changePct} /></td>
                <td className="px-3 py-2">{q.rsi.toFixed(1)}</td>
                <td className="px-3 py-2"><SignalBadge direction={q.signal} /></td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <CardHeader title="Top Losers" subtitle="Penurunan harga terbesar hari ini" />
          <Table headers={["Ticker", "Harga", "Perubahan", "RSI", "Sinyal"]}>
            {losers.map((q) => (
              <tr key={q.ticker}>
                <td className="px-3 py-2">
                  <Link href={`/stock/${q.ticker}`} className="font-medium hover:text-primary">
                    {q.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2">{formatIDR(q.price)}</td>
                <td className="px-3 py-2"><ChangePct value={q.changePct} /></td>
                <td className="px-3 py-2">{q.rsi.toFixed(1)}</td>
                <td className="px-3 py-2"><SignalBadge direction={q.signal} /></td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Sinyal Terbaru"
          subtitle="Sinyal yang dihasilkan engine analisis"
          action={<Link href="/signals" className="text-xs text-primary hover:underline">Semua sinyal →</Link>}
        />
        <Table headers={["Waktu", "Ticker", "Arah", "Sumber", "Alasan", "Harga"]}>
          {MOCK_SIGNALS.slice(0, 4).map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2 text-muted-foreground">{formatTime(s.createdAt)}</td>
              <td className="px-3 py-2 font-medium">{s.ticker}</td>
              <td className="px-3 py-2"><SignalBadge direction={s.direction} /></td>
              <td className="px-3 py-2"><Badge tone="info">{s.source}</Badge></td>
              <td className="px-3 py-2 text-muted-foreground">{s.reason}</td>
              <td className="px-3 py-2">{formatIDR(s.price)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader title="Ringkasan Pasar" subtitle="Indeks & benchmark (data contoh)" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { name: "IHSG", value: "7.412,55", pct: 0.84 },
            { name: "LQ45", value: "1.024,30", pct: 0.61 },
            { name: "IDX30", value: "512,18", pct: 0.45 },
            { name: "USD/IDR", value: "15.420", pct: -0.12 },
          ].map((idx) => (
            <div key={idx.name} className="rounded-lg border border-border bg-muted p-3">
              <p className="text-xs text-muted-foreground">{idx.name}</p>
              <p className="mt-1 text-lg font-semibold">{idx.value}</p>
              <p className="text-xs"><ChangePct value={idx.pct} /></p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}