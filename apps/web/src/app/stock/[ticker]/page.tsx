import { notFound } from "next/navigation";
import StockChart from "@/components/StockChart";
import { Card, CardHeader, Badge, Table } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import { MOCK_QUOTES, MOCK_SIGNALS, generateMockCandles } from "@/lib/mock";
import { formatIDR, formatPct } from "@/lib/format";

export default function StockDetailPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const quote = MOCK_QUOTES.find((q) => q.ticker === ticker);

  if (!quote) notFound();

  const candles = generateMockCandles(quote.price * 0.9, 120, quote.price % 100);
  const signals = MOCK_SIGNALS.filter((s) => s.ticker === ticker);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{ticker}</h1>
            <SignalBadge direction={quote.signal} />
          </div>
          <p className="text-sm text-muted-foreground">{quote.name} · IDX</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatIDR(quote.price)}</p>
          <p className="text-sm">
            <ChangePct value={quote.changePct} /> · {formatPct(quote.changePct)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Chart Harga"
          subtitle="Candlestick harian · 120 hari"
          action={
            <div className="flex gap-1">
              {["1M", "3M", "6M", "1Y"].map((tf) => (
                <button key={tf} className="btn-ghost px-2 py-1 text-xs">
                  {tf}
                </button>
              ))}
            </div>
          }
        />
        <StockChart candles={candles} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Indikator Teknikal" subtitle="Snapshot harian" />
          <div className="space-y-2 text-sm">
            {[
              ["MA20", "9.612", "di atas harga"],
              ["MA50", "9.480", "di atas harga"],
              ["RSI (14)", "58.2", "netral"],
              ["MACD", "Histogram +12.4", "bullish"],
              ["Bollinger", "9.410 – 9.890", "mid-band"],
              ["ATR (14)", "142.5", "—"],
            ].map(([label, value, note]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
                <span className="text-xs text-muted-foreground">{note}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Fundamental" subtitle="Data contoh — verifikasi sumber" />
          <div className="space-y-2 text-sm">
            {[
              ["PER", "21.4x"],
              ["PBV", "4.8x"],
              ["ROE", "21.2%"],
              ["EPS", "Rp 455"],
              ["Dividend Yield", "2.6%"],
              ["Market Cap", "Rp 1.202T"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Sinyal Terkait" subtitle={`${signals.length} sinyal terakhir`} />
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada sinyal untuk saham ini.</p>
          ) : (
            <div className="space-y-2">
              {signals.map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <SignalBadge direction={s.direction} />
                    <Badge tone="info">{s.source}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{s.reason}</p>
                  <p className="mt-1 text-xs">
                    Kekuatan: <span className="font-medium">{(s.strength * 100).toFixed(0)}%</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Riwayat Harga" subtitle="Data OHLCV harian" />
        <Table headers={["Tanggal", "Open", "High", "Low", "Close", "Volume"]}>
          {candles.slice(-10).reverse().map((c) => (
            <tr key={c.time}>
              <td className="px-3 py-2 text-muted-foreground">{c.time}</td>
              <td className="px-3 py-2">{formatIDR(c.open)}</td>
              <td className="px-3 py-2">{formatIDR(c.high)}</td>
              <td className="px-3 py-2">{formatIDR(c.low)}</td>
              <td className="px-3 py-2 font-medium">{formatIDR(c.close)}</td>
              <td className="px-3 py-2 text-muted-foreground">—</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}