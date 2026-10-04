import Link from "next/link";
import { Card, CardHeader, StatCard, Table, Badge } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import { ForeignNet } from "@/components/ForeignNet";
import { getBotOverview, getQuotes, getSignalCount24h, getSignals } from "@/lib/data";
import { cn, formatIDR, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [quotes, signals, signalCount, bot] = await Promise.all([
    getQuotes(),
    getSignals(20),
    getSignalCount24h(),
    getBotOverview(),
  ]);

  const gainers = [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
  const losers = [...quotes].sort((a, b) => a.changePct - b.changePct).slice(0, 3);
  const buyCount = signals.filter((s) => s.direction === "BUY").length;
  const sellCount = signals.filter((s) => s.direction === "SELL").length;
  const running = bot.status === "RUNNING";

  // PRD 4.1: net foreign flow hari ini + top net foreign buy/sell.
  const foreignRanked = quotes.filter((q) => q.foreignNet1d !== 0).sort((a, b) => b.foreignNet1d - a.foreignNet1d);
  const foreignBuyers = foreignRanked.filter((q) => q.foreignNet1d > 0).slice(0, 3);
  const foreignSellers = foreignRanked.filter((q) => q.foreignNet1d < 0).reverse().slice(0, 3);
  const netForeignTotal = quotes.reduce((sum, q) => sum + q.foreignNet1d, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan pasar, watchlist, dan sinyal terbaru
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saham Dipantau" value={String(quotes.length)} sub="saham aktif" />
        <StatCard
          label="Sinyal Hari Ini"
          value={String(signalCount)}
          sub={`${buyCount} BUY · ${sellCount} SELL`}
          tone="success"
        />
        <StatCard label="Posisi Terbuka" value={String(bot.openPositions)} sub={`Mode ${bot.mode}`} />
        <StatCard
          label="Bot Status"
          value={running ? "Running" : "Stopped"}
          sub={bot.killSwitch ? "kill switch AKTIF" : bot.mode}
          tone={running ? "success" : "default"}
        />
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
          title="Net Foreign Flow"
          subtitle="Top net buy & net sell asing pada sesi terakhir"
          action={
            <span className="text-xs text-muted-foreground">
              Total sesi: <ForeignNet value={netForeignTotal} />
            </span>
          }
        />
        {foreignRanked.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada data foreign flow untuk saham yang dipantau.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Top Net Buy", rows: foreignBuyers, tone: "text-success" },
              { title: "Top Net Sell", rows: foreignSellers, tone: "text-danger" },
            ].map((group) => (
              <div key={group.title}>
                <p className={cn("mb-2 text-xs font-semibold", group.tone)}>{group.title}</p>
                {group.rows.length === 0 ? (
                  <p className="rounded-lg bg-muted py-4 text-center text-xs text-muted-foreground">
                    Tidak ada saham pada kategori ini.
                  </p>
                ) : (
                  <Table headers={["Ticker", "Harga", "Net Asing"]}>
                    {group.rows.map((q) => (
                      <tr key={q.ticker}>
                        <td className="px-3 py-2">
                          <Link href={`/stock/${q.ticker}`} className="font-medium hover:text-primary">
                            {q.ticker}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{formatIDR(q.price)}</td>
                        <td className="px-3 py-2 text-right">
                          <ForeignNet value={q.foreignNet1d} />
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Sinyal Terbaru"
          subtitle="Sinyal yang dihasilkan engine analisis"
          action={<Link href="/signals" className="text-xs text-primary hover:underline">Semua sinyal →</Link>}
        />
        <Table headers={["Waktu", "Ticker", "Arah", "Sumber", "Alasan", "Harga"]}>
          {signals.slice(0, 4).map((s) => (
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