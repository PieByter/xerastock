import Link from "next/link";
import { Card, CardHeader, StatCard, Table, Badge } from "@/components/ui";
import { getPortfolio } from "@/lib/data";
import { cn, formatIDR, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Area chart ringan (SVG inline) — tanpa dependency chart tambahan. */
function PerformanceChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Riwayat performa belum tersedia — jalankan paper trading untuk mengumpulkan data.
      </p>
    );
  }

  const w = 600;
  const h = 160;
  const pad = 10;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((p, i) => ({
    x: pad + (i / (points.length - 1)) * (w - pad * 2),
    y: h - pad - ((p.value - min) / span) * (h - pad * 2),
  }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]!.x.toFixed(1)},${h} L${coords[0]!.x.toFixed(1)},${h} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2F81F7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2F81F7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#portfolioGradient)" />
        <path d={line} fill="none" stroke="#2F81F7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0]!.date}</span>
        <span>{formatIDR(max, true)}</span>
        <span>{points[points.length - 1]!.date}</span>
      </div>
    </div>
  );
}

function SectorDonut({ allocation }: { allocation: { sector: string; value: number; percentage: number; color: string }[] }) {
  if (allocation.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada alokasi sektor.</p>;
  }

  let cursor = 0;
  const stops = allocation.map((a) => {
    const start = cursor;
    cursor += a.percentage;
    return `${a.color} ${start}% ${cursor}%`;
  });

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-32 w-32 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="absolute inset-[18%] rounded-full bg-card" />
      </div>
      <div className="space-y-2 text-sm">
        {allocation.map((a) => (
          <div key={a.sector} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
            <span className="min-w-28 text-muted-foreground">{a.sector}</span>
            <span className="font-medium tabular-nums">{a.percentage}%</span>
            <span className="text-xs text-muted-foreground tabular-nums">{formatIDR(a.value, true)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function PortfolioPage() {
  const portfolio = await getPortfolio();
  const pnlTone = (v: number) => (v >= 0 ? "text-success" : "text-danger");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Nilai aset, alokasi sektor, dan unrealized P/L posisi paper trading
          </p>
        </div>
        {portfolio.isDemo && <Badge tone="warning">Data contoh</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Nilai Portofolio" value={formatIDR(portfolio.totalValue, true)} sub={`Modal ${formatIDR(portfolio.totalInvested, true)}`} />
        <StatCard
          label="P/L Hari Ini"
          value={formatIDR(portfolio.todayPnl, true)}
          sub={formatPct(portfolio.todayPnlPct)}
          tone={portfolio.todayPnl >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Total P/L"
          value={formatIDR(portfolio.totalPnl, true)}
          sub={formatPct(portfolio.totalPnlPct)}
          tone={portfolio.totalPnl >= 0 ? "success" : "danger"}
        />
        <StatCard label="Kas" value={formatIDR(portfolio.cashBalance, true)} sub="saldo akun paper" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Performa Portofolio" subtitle="Nilai aset dari waktu ke waktu" />
          <PerformanceChart points={portfolio.performance} />
        </Card>
        <Card>
          <CardHeader title="Alokasi Sektor" subtitle="Proporsi nilai pasar per sektor" />
          <SectorDonut allocation={portfolio.sectorAllocation} />
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Kepemilikan"
          subtitle={`${portfolio.holdings.length} posisi terbuka`}
          action={
            <Link href="/bot" className="text-xs text-primary hover:underline">
              Riwayat trade →
            </Link>
          }
        />
        {portfolio.holdings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada posisi terbuka. Sinyal paper trading akan muncul di sini.
          </p>
        ) : (
          <Table
            headers={["Ticker", "Nama", "Lot", "Avg", "Harga", "Nilai Pasar", "Unrealized P/L", "P/L %", "Harian", "Bobot"]}
          >
            {portfolio.holdings.map((h) => (
              <tr key={h.ticker}>
                <td className="px-3 py-2">
                  <Link href={`/stock/${h.ticker}`} className="font-medium hover:text-primary">
                    {h.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{h.name}</td>
                <td className="px-3 py-2 tabular-nums">{h.lots}</td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(h.avgPrice)}</td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(h.currentPrice)}</td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(h.marketValue)}</td>
                <td className={cn("px-3 py-2 tabular-nums", pnlTone(h.unrealizedPnl))}>
                  {h.unrealizedPnl >= 0 ? "+" : ""}
                  {formatIDR(h.unrealizedPnl)}
                </td>
                <td className={cn("px-3 py-2 tabular-nums", pnlTone(h.unrealizedPnlPct))}>{formatPct(h.unrealizedPnlPct)}</td>
                <td className={cn("px-3 py-2 tabular-nums", pnlTone(h.dailyChangePct))}>{formatPct(h.dailyChangePct)}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{h.weightPct}%</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
