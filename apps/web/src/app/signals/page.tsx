import { Card, CardHeader, Table, Badge, StatCard } from "@/components/ui";
import { SignalBadge } from "@/components/SignalBadge";
import {
  getRuleFrequency,
  getSignalLog,
  getSignals,
  getStrategyPerformance,
} from "@/lib/data";
import { STRATEGY_CONFIG } from "@stock-analyst/shared";
import { cn, formatDate, formatIDR, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function StrategyBadge({ type }: { type: string }) {
  const config = STRATEGY_CONFIG[type as keyof typeof STRATEGY_CONFIG];
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        config?.badgeClass ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {config?.shortName ?? type}
    </span>
  );
}

function ExecutionBadge({ execution }: { execution: string }) {
  if (execution === "filled:buy") return <Badge tone="success">posisi dibuka</Badge>;
  if (execution === "filled:sell") return <Badge tone="info">posisi ditutup</Badge>;
  if (execution === "error") return <Badge tone="danger">error</Badge>;
  if (execution.startsWith("skipped") || execution === "not-executed") {
    return (
      <Badge tone="muted">
        {execution === "not-executed" ? "tanpa eksekusi" : execution.replace("skipped:", "skip: ")}
      </Badge>
    );
  }
  return <Badge tone="warning">{execution.replace("gagal:", "gagal: ")}</Badge>;
}

export default async function SignalsPage() {
  const [signals, log, performance, rules] = await Promise.all([
    getSignals(12),
    getSignalLog(40),
    getStrategyPerformance(),
    getRuleFrequency(),
  ]);

  const isDemo = log.some((row) => row.isDemo);
  const totalMatches = performance.reduce((sum, row) => sum + row.matches, 0);
  const totalClosed = performance.reduce((sum, row) => sum + row.closed, 0);
  const totalPnl = performance.reduce((sum, row) => sum + row.totalPnl, 0);
  const wins = performance.reduce((sum, row) => sum + row.wins, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sinyal &amp; Performa</h1>
          <p className="text-sm text-muted-foreground">
            Sinyal terbaru, arsip kondisi saat match, dan hasil evaluasi tiap strategi
          </p>
        </div>
        {isDemo && <Badge tone="warning">Data contoh</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Match" value={String(totalMatches)} sub="tersimpan di SignalLog" />
        <StatCard label="Dieksekusi" value={String(totalClosed)} sub="posisi tertutup dengan PnL" />
        <StatCard
          label="Win Rate"
          value={totalClosed > 0 ? `${((wins / totalClosed) * 100).toFixed(0)}%` : "—"}
          sub={`${wins} menang dari ${totalClosed}`}
          tone={totalClosed > 0 && wins / totalClosed >= 0.5 ? "success" : "default"}
        />
        <StatCard
          label="Total PnL"
          value={formatIDR(totalPnl, true)}
          sub="paper trading"
          tone={totalPnl >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Performa per Strategi" subtitle="Match, eksekusi, dan hasil per gaya trading" />
          {performance.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada sinyal tercatat. Jalankan evaluasi (worker) untuk mengisi log.
            </p>
          ) : (
            <Table headers={["Strategi", "Match", "Eksekusi", "Win", "Win Rate", "Total PnL"]}>
              {performance.map((row) => (
                <tr key={row.strategyType}>
                  <td className="px-3 py-2">
                    <StrategyBadge type={row.strategyType} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.matches}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.executed}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.wins}</td>
                  <td className="px-3 py-2 tabular-nums">{row.closed > 0 ? `${row.winRate}%` : "—"}</td>
                  <td
                    className={cn(
                      "px-3 py-2 tabular-nums font-medium",
                      row.totalPnl >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {row.totalPnl >= 0 ? "+" : ""}
                    {formatIDR(row.totalPnl, true)}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Rule Paling Sering Match" subtitle="Dasar evaluasi: rule mana yang produktif" />
          {rules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada data rule.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.rule} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                  <span className="truncate text-sm" title={rule.rule}>
                    {rule.rule}
                  </span>
                  <span className="ml-3 flex shrink-0 items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{rule.matches}×</span>
                    <span className={rule.winRate >= 50 ? "text-success" : "text-muted-foreground"}>
                      {rule.winRate}% menang
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Signal Log"
          subtitle="Arsip kondisi saat sinyal match — dipakai untuk menilai ulang rule"
        />
        {log.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada log sinyal.</p>
        ) : (
          <Table headers={["Waktu", "Ticker", "Strategi", "Arah", "Kondisi saat match", "Harga", "RSI", "Vol", "Eksekusi", "PnL"]}>
            {log.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {formatDate(row.matchedAt)} · {formatTime(row.matchedAt)}
                </td>
                <td className="px-3 py-2 font-medium">{row.ticker}</td>
                <td className="px-3 py-2">
                  <StrategyBadge type={row.strategyType} />
                </td>
                <td className="px-3 py-2">
                  <SignalBadge direction={(row.direction as "BUY" | "SELL" | "WATCH") ?? "WATCH"} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{row.reasons.join(" · ") || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{row.price == null ? "—" : formatIDR(row.price)}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.rsi14 ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {row.volumeRatio == null ? "—" : `${row.volumeRatio}×`}
                </td>
                <td className="px-3 py-2">
                  <ExecutionBadge execution={row.execution} />
                </td>
                <td
                  className={cn(
                    "px-3 py-2 tabular-nums",
                    row.pnl == null ? "text-muted-foreground" : row.pnl >= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {row.pnl == null ? "—" : `${row.pnl >= 0 ? "+" : ""}${formatIDR(row.pnl, true)}`}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Sinyal Terbaru" subtitle="Kartu ringkas sinyal terakhir" />
        <div className="grid gap-4 lg:grid-cols-3">
          {signals.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{s.ticker}</span>
                  <SignalBadge direction={s.direction} />
                </div>
                <Badge tone="info">{s.source}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{s.reason}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span>
                  Harga: <span className="font-medium">{formatIDR(s.price)}</span>
                </span>
                <span>
                  Kekuatan: <span className="font-medium">{(s.strength * 100).toFixed(0)}%</span>
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDate(s.createdAt)} · {formatTime(s.createdAt)} WIB
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}