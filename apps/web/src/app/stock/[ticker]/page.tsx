import Link from "next/link";
import { notFound } from "next/navigation";
import StockChart from "@/components/StockChart";
import ForeignFlowChart from "@/components/ForeignFlowChart";
import { ForeignNet } from "@/components/ForeignNet";
import BrokerSummaryPanel from "@/components/BrokerSummaryPanel";
import {
  FlowTrendSummary,
  LevelsCard,
  RangeCard,
  ReturnsCard,
  VolumeVolatilityPanel,
} from "@/components/analysis";
import { Card, CardHeader, Badge, Table } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import { getStockDetail } from "@/lib/data";
import { resolveBrokerPeriod, type BrokerPeriodKey } from "@/lib/brokerAnalysis";
import { cn, formatCompact, formatIDR, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = [
  { key: "1M", days: 22 },
  { key: "3M", days: 66 },
  { key: "6M", days: 132 },
  { key: "1Y", days: 252 },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

function resolveRange(value: string | string[] | undefined): RangeKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return RANGE_OPTIONS.find((option) => option.key === raw)?.key ?? "6M";
}

export default async function StockDetailPage({
  params,
  searchParams,
}: {
  params: { ticker: string };
  searchParams: { broker?: string; range?: string };
}) {
  const ticker = params.ticker.toUpperCase();
  const rangeKey = resolveRange(searchParams.range);
  const period = resolveBrokerPeriod(searchParams.broker);

  const detail = await getStockDetail(ticker, { brokerPeriod: period });

  if (!detail) notFound();

  const { quote, candles, indicators, fundamentals, signals, stats, levels, brokerSummary, foreignFlow, isDemo } =
    detail;

  const rangeDays = RANGE_OPTIONS.find((option) => option.key === rangeKey)!.days;
  const visibleCandles = candles.slice(-rangeDays);

  /** URL halaman ini dengan pilihan periode/rentang lain tetap dipertahankan. */
  const href = (next: { broker?: BrokerPeriodKey; range?: RangeKey }): string => {
    const query = new URLSearchParams();
    const nextBroker = next.broker ?? period;
    const nextRange = next.range ?? rangeKey;
    if (nextBroker !== "1d") query.set("broker", nextBroker);
    if (nextRange !== "6M") query.set("range", nextRange);
    const qs = query.toString();
    return `/stock/${ticker}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{ticker}</h1>
            <SignalBadge direction={quote.signal} />
          </div>
          <p className="text-sm text-muted-foreground">
            {quote.name} · IDX{isDemo ? " · data contoh" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatIDR(quote.price)}</p>
          <p className="text-sm">
            <ChangePct value={quote.changePct} /> · {formatPct(quote.changePct)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Net asing <ForeignNet value={quote.foreignNet1d} />
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 lg:grid-cols-3">
          <RangeCard stats={stats} price={quote.price} />
          <div className="lg:col-span-2">
            <ReturnsCard returns={stats.returns} />
          </div>
        </div>
      )}

      {stats && <VolumeVolatilityPanel stats={stats} />}

      <Card>
        <CardHeader
          title="Chart Harga"
          subtitle={`Candlestick harian · ${visibleCandles.length} hari`}
          action={
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
              {RANGE_OPTIONS.map((option) => (
                <Link
                  key={option.key}
                  href={href({ range: option.key })}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    option.key === rangeKey
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.key}
                </Link>
              ))}
            </div>
          }
        />
        <StockChart candles={visibleCandles} />
      </Card>

      <BrokerSummaryPanel summary={brokerSummary} periodHref={(key) => href({ broker: key })} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Indikator Teknikal" subtitle="Snapshot harian" />
          {indicators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Data indikator belum tersedia.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {indicators.map((ind) => (
                <div key={ind.label} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                  <span className="text-muted-foreground">{ind.label}</span>
                  <span className="font-medium">{ind.value}</span>
                  <span className="text-xs text-muted-foreground">{ind.note}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Fundamental"
            subtitle={isDemo ? "Data contoh — verifikasi sumber" : "Snapshot terbaru"}
          />
          {fundamentals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Data fundamental belum tersedia.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {fundamentals.map((f) => (
                <div key={f.label} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          )}
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Net Foreign Flow"
            subtitle="Bar = net harian · garis = net kumulatif"
            action={foreignFlow ? <Badge tone="info">{foreignFlow.tradingDays} hari</Badge> : undefined}
          />
          {foreignFlow ? (
            <>
              <FlowTrendSummary flow={foreignFlow} />
              <div className="mt-3">
                <ForeignFlowChart points={foreignFlow.points} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Garis kumulatif menanjak menandakan asing mengakumulasi, menurun berarti distribusi. Dihitung
                dari kolom foreign pada data harga harian.
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada data foreign flow — kolom foreign pada tabel harga masih kosong.
            </p>
          )}
        </Card>

        <LevelsCard levels={levels} price={quote.price} />
      </div>

      <Card>
        <CardHeader title="Riwayat Harga" subtitle="Data OHLCV harian 10 hari terakhir" />
        <Table headers={["Tanggal", "Open", "High", "Low", "Close", "Volume", "Net Asing"]}>
          {candles.slice(-10).reverse().map((c) => (
            <tr key={c.time}>
              <td className="px-3 py-2 text-muted-foreground">{c.time}</td>
              <td className="px-3 py-2">{formatIDR(c.open)}</td>
              <td className="px-3 py-2">{formatIDR(c.high)}</td>
              <td className="px-3 py-2">{formatIDR(c.low)}</td>
              <td className="px-3 py-2 font-medium">{formatIDR(c.close)}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {c.volume > 0 ? formatCompact(c.volume) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <ForeignNet value={c.foreignNet ?? 0} />
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}