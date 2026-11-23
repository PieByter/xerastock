"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Badge, Table } from "@/components/ui";
import { createAlertAction, deleteAlertAction, setAlertStatusAction } from "@/app/actions";
import type { AlertView } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/format";

interface Notice {
  ok: boolean;
  message: string;
}

const ALERT_TYPES = [
  { value: "PRICE_ABOVE", label: "Harga ≥ level" },
  { value: "PRICE_BELOW", label: "Harga ≤ level" },
  { value: "SIGNAL", label: "Saat sinyal match" },
  { value: "CHANNEL_BREAK", label: "Channel break (N hari)" },
] as const;

const TYPE_LABEL = Object.fromEntries(ALERT_TYPES.map((item) => [item.value, item.label])) as Record<string, string>;

function conditionText(alert: AlertView): string {
  const level = Number(alert.condition.level ?? 0);
  const period = Number(alert.condition.period ?? 20);
  const direction = String(alert.condition.direction ?? "above");

  if (alert.type === "PRICE_ABOVE") return `≥ ${level.toLocaleString("id-ID")}`;
  if (alert.type === "PRICE_BELOW") return `≤ ${level.toLocaleString("id-ID")}`;
  if (alert.type === "CHANNEL_BREAK") {
    return `${direction === "below" ? "tembus support" : "tembus resistance"} ${period} hari`;
  }
  if (alert.type === "SIGNAL") return "setiap sinyal baru";
  return "—";
}

function statusTone(status: string): "success" | "warning" | "muted" {
  if (status === "ACTIVE") return "success";
  if (status === "TRIGGERED") return "warning";
  return "muted";
}

export default function AlertManager({
  alerts,
  stocks,
  isDemo,
}: {
  alerts: AlertView[];
  stocks: { ticker: string; name: string }[];
  isDemo: boolean;
}) {
  const router = useRouter();
  const [ticker, setTicker] = useState(stocks[0]?.ticker ?? "BBCA.JK");
  const [type, setType] = useState<string>("PRICE_ABOVE");
  const [level, setLevel] = useState("10000");
  const [period, setPeriod] = useState("20");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [repeat, setRepeat] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<Notice>) => {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) router.refresh();
    });
  };

  const create = () => {
    run(() =>
      createAlertAction({
        ticker,
        type: type as "PRICE_ABOVE" | "PRICE_BELOW" | "SIGNAL" | "CHANNEL_BREAK",
        level: Number(level),
        period: Number(period),
        direction,
        repeat,
      }),
    );
  };

  const priceType = type === "PRICE_ABOVE" || type === "PRICE_BELOW";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Notifikasi harga, sinyal, dan channel break — dikirim ke Discord/Telegram
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && <Badge tone="warning">Database belum aktif</Badge>}
          {notice && <Badge tone={notice.ok ? "success" : "danger"}>{notice.message}</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader title="Buat Alert" subtitle="Alert dicek tiap refresh quote (5 menit) atau saat sinyal match" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs text-muted-foreground">Saham</span>
            <select className="input" value={ticker} onChange={(event) => setTicker(event.target.value)}>
              {!stocks.some((stock) => stock.ticker === ticker) && <option value={ticker}>{ticker}</option>}
              {stocks.map((stock) => (
                <option key={stock.ticker} value={stock.ticker}>
                  {stock.ticker} — {stock.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs text-muted-foreground">Jenis alert</span>
            <select className="input" value={type} onChange={(event) => setType(event.target.value)}>
              {ALERT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {priceType && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Level harga</span>
              <input
                className="input"
                type="number"
                min={1}
                step="any"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
              />
            </label>
          )}

          {type === "CHANNEL_BREAK" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Periode (hari)</span>
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={120}
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Arah</span>
                <select
                  className="input"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value === "below" ? "below" : "above")}
                >
                  <option value="above">Breakout ke atas</option>
                  <option value="below">Breakdown ke bawah</option>
                </select>
              </label>
            </>
          )}

          <label className="flex items-end gap-2 pb-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} />
            Ulangi setiap trigger
          </label>

          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={create}
              disabled={isPending || isDemo}
            >
              Buat alert
            </button>
          </div>
        </div>
        {isDemo && (
          <p className="mt-3 text-xs text-muted-foreground">
            Alert membutuhkan DATABASE_URL. Tanpa database, form tetap bisa diisi tetapi tidak menyimpan.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Daftar Alert"
          subtitle={`${alerts.length} alert tersimpan`}
          action={<Badge tone="info">{alerts.filter((alert) => alert.status === "ACTIVE").length} aktif</Badge>}
        />
        {alerts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada alert. Buat alert pertama di atas.
          </p>
        ) : (
          <Table headers={["Ticker", "Jenis", "Kondisi", "Status", "Terakhir trigger", "Aksi"]}>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td className="px-3 py-2 font-medium">{alert.ticker}</td>
                <td className="px-3 py-2 text-muted-foreground">{TYPE_LABEL[alert.type] ?? alert.type}</td>
                <td className="px-3 py-2">{conditionText(alert)}</td>
                <td className="px-3 py-2">
                  <Badge tone={statusTone(alert.status)}>{alert.status}</Badge>
                  {alert.repeat && <span className="ml-2 text-[11px] text-muted-foreground">repeat</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {alert.lastTriggeredAt
                    ? `${formatDate(alert.lastTriggeredAt)} · ${formatTime(alert.lastTriggeredAt)}`
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      disabled={isPending}
                      onClick={() =>
                        run(() =>
                          setAlertStatusAction(alert.id, alert.status === "DISABLED" ? "ACTIVE" : "DISABLED"),
                        )
                      }
                    >
                      {alert.status === "DISABLED" ? "Aktifkan" : "Nonaktifkan"}
                    </button>
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm(`Hapus alert ${alert.ticker}?`)) {
                          run(() => deleteAlertAction(alert.id));
                        }
                      }}
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
