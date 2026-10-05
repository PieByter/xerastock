"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, Table, Badge, StatCard } from "@/components/ui";
import { runBacktestAction } from "@/app/actions";
import type { BacktestOptions, BacktestRunResponse } from "@/lib/backtest";
import type { BacktestTrade } from "@stock-analyst/engine";
import { formatDate, formatIDR, formatPct, formatNumber } from "@/lib/format";

const DEFAULT_PARAMS = {
  initialBalance: 10_000_000,
  feePct: 0.15,
  slippagePct: 0.1,
  stopLossPct: 5,
  takeProfitPct: 10,
  positionSizePct: 20,
};

const EXIT_LABEL: Record<BacktestTrade["exitReason"], string> = {
  SIGNAL: "Sinyal",
  STOP_LOSS: "Stop loss",
  TAKE_PROFIT: "Take profit",
  OPEN: "Masih terbuka",
};

const EXIT_TONE: Record<BacktestTrade["exitReason"], "success" | "danger" | "info" | "muted"> = {
  SIGNAL: "info",
  STOP_LOSS: "danger",
  TAKE_PROFIT: "success",
  OPEN: "muted",
};

const MAX_TRADES_SHOWN = 50;

function formatProfitFactor(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

export default function BacktestClient({ options }: { options: BacktestOptions }) {
  const [strategyId, setStrategyId] = useState(options.strategies[0]?.id ?? "");
  const [ticker, setTicker] = useState(options.tickers[0]?.ticker ?? "");
  const [bars, setBars] = useState(260);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [outcome, setOutcome] = useState<BacktestRunResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedStrategy = options.strategies.find((s) => s.id === strategyId);

  const setParam = (key: keyof typeof DEFAULT_PARAMS, value: number) =>
    setParams((prev) => ({ ...prev, [key]: value }));

  const onStrategyChange = (id: string) => {
    setStrategyId(id);
    const defaults = options.strategies.find((s) => s.id === id)?.riskDefaults;
    if (defaults) {
      setParams((prev) => ({
        ...prev,
        stopLossPct: defaults.stopLossPct,
        takeProfitPct: defaults.takeProfitPct,
      }));
    }
  };

  const run = () => {
    startTransition(async () => {
      setOutcome(await runBacktestAction({ strategyId, ticker, bars, params }));
    });
  };

  const result = outcome?.ok ? outcome.result : undefined;
  const meta = outcome?.ok ? outcome.meta : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Backtest Strategi</h1>
          <p className="text-sm text-muted-foreground">
            Uji strategi terhadap data historis (next-bar, biaya + slippage)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {outcome && <Badge tone={outcome.ok ? "success" : "danger"}>{outcome.message}</Badge>}
          {options.isDemo && <Badge tone="warning">mode demo</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader
          title="Konfigurasi"
          subtitle="Strategi, saham, rentang data, dan asumsi eksekusi"
          action={
            <button
              className="btn-primary"
              disabled={isPending || !strategyId || !ticker}
              onClick={run}
            >
              {isPending ? "Menjalankan…" : "▶ Jalankan Backtest"}
            </button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Strategi</label>
            <select
              className="input"
              value={strategyId}
              onChange={(e) => onStrategyChange(e.target.value)}
            >
              {options.strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Saham</label>
            <select className="input" value={ticker} onChange={(e) => setTicker(e.target.value)}>
              {options.tickers.length === 0 && <option value="">— belum ada saham aktif —</option>}
              {options.tickers.map((t) => (
                <option key={t.ticker} value={t.ticker}>
                  {t.ticker}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Jumlah bar (histori)</label>
            <input
              type="number"
              className="input"
              min={60}
              max={1000}
              step={20}
              value={bars}
              onChange={(e) => setBars(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Saldo awal (Rp)</label>
            <input
              type="number"
              className="input"
              min={100_000}
              step={1_000_000}
              value={params.initialBalance}
              onChange={(e) => setParam("initialBalance", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Biaya transaksi (%)</label>
            <input
              type="number"
              className="input"
              min={0}
              step={0.05}
              value={params.feePct}
              onChange={(e) => setParam("feePct", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Slippage (%)</label>
            <input
              type="number"
              className="input"
              min={0}
              step={0.05}
              value={params.slippagePct}
              onChange={(e) => setParam("slippagePct", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Stop loss (%)</label>
            <input
              type="number"
              className="input"
              min={0.1}
              step={0.5}
              value={params.stopLossPct}
              onChange={(e) => setParam("stopLossPct", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Take profit (%)</label>
            <input
              type="number"
              className="input"
              min={0.1}
              step={0.5}
              value={params.takeProfitPct}
              onChange={(e) => setParam("takeProfitPct", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Ukuran posisi (% saldo)</label>
            <input
              type="number"
              className="input"
              min={1}
              max={100}
              step={5}
              value={params.positionSizePct}
              onChange={(e) => setParam("positionSizePct", Number(e.target.value))}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Sinyal dieksekusi di bar berikutnya (anti-look-ahead). Slippage memperburuk harga
          masuk/keluar; biaya dipotong dari hasil transaksi.
        </p>
      </Card>

      {!result && !isPending && (
        <Card>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Pilih strategi &amp; saham, lalu jalankan backtest untuk melihat performa historisnya.
            {selectedStrategy ? ` Strategi aktif: ${selectedStrategy.name}.` : ""}
          </p>
        </Card>
      )}

      {isPending && (
        <Card>
          <p className="py-6 text-center text-sm text-muted-foreground">Menghitung backtest…</p>
        </Card>
      )}

      {result && meta && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total PnL"
              value={formatIDR(result.totalPnl)}
              sub={formatPct(result.totalPnlPct)}
              tone={result.totalPnl >= 0 ? "success" : "danger"}
            />
            <StatCard
              label="Saldo akhir"
              value={formatIDR(result.finalBalance)}
              sub={`Awal ${formatIDR(params.initialBalance)}`}
            />
            <StatCard
              label="Win rate"
              value={`${result.winRate.toFixed(1)}%`}
              sub={`${result.trades.length} trade (${result.trades.filter((t) => t.exitReason !== "OPEN").length} tertutup)`}
            />
            <StatCard
              label="Profit factor"
              value={formatProfitFactor(result.profitFactor)}
              sub="Gross profit ÷ gross loss"
            />
            <StatCard
              label="Max drawdown"
              value={`${result.maxDrawdownPct.toFixed(2)}%`}
              tone="danger"
            />
            <StatCard
              label="Periode"
              value={`${meta.bars} bar`}
              sub={
                meta.from > 0
                  ? `${formatDate(new Date(meta.from))} → ${formatDate(new Date(meta.to))}`
                  : undefined
              }
            />
          </div>

          <Card>
            <CardHeader
              title="Riwayat Trade"
              subtitle={`${meta.strategyName} · ${meta.ticker}${meta.isDemo ? " · data contoh" : ""}`}
              action={<Badge tone="info">{result.trades.length} trade</Badge>}
            />
            {result.trades.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada trade — rule strategi tidak pernah match pada rentang data ini.
              </p>
            ) : (
              <Table
                headers={[
                  "#",
                  "Masuk",
                  "Harga masuk",
                  "Keluar",
                  "Harga keluar",
                  "Qty",
                  "PnL",
                  "PnL %",
                  "Alasan",
                ]}
              >
                {result.trades.slice(0, MAX_TRADES_SHOWN).map((trade, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2">
                      {trade.entryDate > 1_000_000_000_000
                        ? formatDate(new Date(trade.entryDate))
                        : `bar #${trade.entryDate}`}
                    </td>
                    <td className="px-3 py-2">{formatIDR(trade.entryPrice)}</td>
                    <td className="px-3 py-2">
                      {trade.exitDate == null
                        ? "—"
                        : trade.exitDate > 1_000_000_000_000
                          ? formatDate(new Date(trade.exitDate))
                          : `bar #${trade.exitDate}`}
                    </td>
                    <td className="px-3 py-2">
                      {trade.exitPrice == null ? "—" : formatIDR(trade.exitPrice)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatNumber(trade.qty)}</td>
                    <td
                      className={`px-3 py-2 font-medium ${trade.pnl >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {formatIDR(trade.pnl)}
                    </td>
                    <td className={`px-3 py-2 ${trade.pnl >= 0 ? "text-success" : "text-danger"}`}>
                      {formatPct(trade.pnlPct)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={EXIT_TONE[trade.exitReason]}>{EXIT_LABEL[trade.exitReason]}</Badge>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            {result.trades.length > MAX_TRADES_SHOWN && (
              <p className="mt-3 text-xs text-muted-foreground">
                Menampilkan {MAX_TRADES_SHOWN} trade pertama dari {result.trades.length}.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
