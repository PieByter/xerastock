import Link from "next/link";
import { Card, CardHeader, StatCard, Table, Badge } from "@/components/ui";
import { ChangePct } from "@/components/SignalBadge";
import { getTechnicalOverview, type TechnicalRow, type TrendLabel } from "@/lib/data";
import { cn, formatIDR } from "@/lib/format";

export const dynamic = "force-dynamic";

const TREND_FILTERS: { key: TrendLabel | "all"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "bullish", label: "Bullish" },
  { key: "bearish", label: "Bearish" },
  { key: "neutral", label: "Netral" },
];

function resolveTrend(value: string | string[] | undefined): TrendLabel | "all" {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "bullish" || raw === "bearish" || raw === "neutral" ? raw : "all";
}

function RsiCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone = value >= 70 ? "text-danger" : value <= 30 ? "text-success" : "text-foreground";
  const label = value >= 70 ? "overbought" : value <= 30 ? "oversold" : "netral";
  return (
    <span className="flex items-center justify-end gap-2">
      <span className={cn("font-medium tabular-nums", tone)}>{value.toFixed(1)}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

function TrendBadge({ trend }: { trend: TechnicalRow["trend"] }) {
  const tone = trend === "bullish" ? "success" : trend === "bearish" ? "danger" : "muted";
  const label = trend === "bullish" ? "BULLISH" : trend === "bearish" ? "BEARISH" : "NETRAL";
  return <Badge tone={tone}>{label}</Badge>;
}

export default async function TechnicalPage({
  searchParams,
}: {
  searchParams: { trend?: string };
}) {
  const rows = await getTechnicalOverview();
  const filter = resolveTrend(searchParams.trend);
  const visible = filter === "all" ? rows : rows.filter((r) => r.trend === filter);

  const bullish = rows.filter((r) => r.trend === "bullish").length;
  const bearish = rows.filter((r) => r.trend === "bearish").length;
  const oversold = rows.filter((r) => r.rsi != null && r.rsi <= 30).length;
  const overbought = rows.filter((r) => r.rsi != null && r.rsi >= 70).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Technical Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan indikator seluruh saham pantauan: MA, RSI, MACD, Bollinger, dan ATR
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tren Bullish" value={String(bullish)} sub="MA50 + MACD" tone="success" />
        <StatCard label="Tren Bearish" value={String(bearish)} sub="MA50 + MACD" tone="danger" />
        <StatCard label="Oversold (RSI ≤ 30)" value={String(oversold)} sub="kandidat rebound" />
        <StatCard label="Overbought (RSI ≥ 70)" value={String(overbought)} sub="risiko koreksi" />
      </div>

      <Card>
        <CardHeader
          title="Indikator per Saham"
          subtitle={`${visible.length} saham ditampilkan`}
          action={
            <div className="flex gap-1">
              {TREND_FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/technical" : `/technical?trend=${f.key}`}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs transition-colors",
                    filter === f.key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          }
        />
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada saham dengan tren ini.
          </p>
        ) : (
          <Table
            headers={[
              "Ticker",
              "Harga",
              "Perubahan",
              "MA20",
              "MA50",
              "RSI (14)",
              "MACD Hist.",
              "Bollinger",
              "ATR (14)",
              "Tren",
            ]}
          >
            {visible.map((row) => (
              <tr key={row.ticker}>
                <td className="px-3 py-2">
                  <Link href={`/stock/${row.ticker}`} className="font-medium hover:text-primary">
                    {row.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatIDR(row.price)}</td>
                <td className="px-3 py-2">
                  <ChangePct value={row.changePct} />
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {row.ma20 == null ? "—" : formatIDR(row.ma20)}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {row.ma50 == null ? "—" : formatIDR(row.ma50)}
                </td>
                <td className="px-3 py-2 text-right">
                  <RsiCell value={row.rsi} />
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    row.macdHistogram == null
                      ? "text-muted-foreground"
                      : row.macdHistogram >= 0
                        ? "text-success"
                        : "text-danger",
                  )}
                >
                  {row.macdHistogram == null ? "—" : `${row.macdHistogram >= 0 ? "+" : ""}${row.macdHistogram}`}
                </td>
                <td className="px-3 py-2 text-right">
                  {row.bollingerPosition === "upper" ? (
                    <Badge tone="danger">di atas upper</Badge>
                  ) : row.bollingerPosition === "lower" ? (
                    <Badge tone="success">di bawah lower</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">dalam band</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.atr == null ? "—" : row.atr}
                </td>
                <td className="px-3 py-2">
                  <TrendBadge trend={row.trend} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
