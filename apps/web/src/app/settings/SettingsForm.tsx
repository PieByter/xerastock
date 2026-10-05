"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, Badge } from "@/components/ui";
import { updateBotAction, updateRiskAction } from "@/app/actions";

interface Props {
  initial: {
    mode: string;
    status: string;
    killSwitch: boolean;
    risk: {
      stopLoss: number;
      takeProfit: number;
      riskPerPosition: number;
      dailyLossLimit: number;
      maxPositions: number;
    };
  };
}

const MODES = ["SIGNAL_ONLY", "PAPER", "LIVE"] as const;

export default function SettingsForm({ initial }: Props) {
  const [mode, setMode] = useState(initial.mode);
  const [risk, setRisk] = useState({
    stopLossPct: initial.risk.stopLoss,
    takeProfitPct: initial.risk.takeProfit,
    riskPerPositionPct: initial.risk.riskPerPosition,
    dailyLossLimitPct: initial.risk.dailyLossLimit,
    maxPositions: initial.risk.maxPositions,
  });
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => setNotice(await action()));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pengaturan</h1>
          <p className="text-sm text-muted-foreground">Konfigurasi bot, strategi, dan notifikasi</p>
        </div>
        <div className="flex items-center gap-2">
          {notice && <Badge tone={notice.ok ? "success" : "danger"}>{notice.message}</Badge>}
          <Badge tone={initial.status === "RUNNING" ? "success" : "muted"}>● {initial.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Mode Bot" subtitle="SIGNAL_ONLY → PAPER → LIVE (Fase 3)" />
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m}
                disabled={isPending}
                onClick={() => {
                  setMode(m);
                  run(() => updateBotAction({ mode: m }));
                }}
                className={`btn ${mode === m ? "btn-primary" : "btn-ghost"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {mode === "SIGNAL_ONLY" && "Bot hanya menghasilkan sinyal & notifikasi. Tidak ada eksekusi."}
            {mode === "PAPER" && "Trade disimulasikan dengan saldo virtual. Aman untuk uji strategi."}
            {mode === "LIVE" && "⚠️ Eksekusi order riil via broker. Belum tersedia — integrasi broker menyusul."}
          </p>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
            <div>
              <p className="font-medium">Kill switch</p>
              <p className="text-xs text-muted-foreground">Hentikan semua evaluasi & eksekusi trading</p>
            </div>
            <button
              disabled={isPending}
              className={initial.killSwitch ? "btn-primary" : "btn-ghost"}
              onClick={() => run(() => updateBotAction({ killSwitch: !initial.killSwitch }))}
            >
              {initial.killSwitch ? "AKTIF — klik untuk matikan" : "Nonaktif"}
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Notifikasi Discord" subtitle="Channel dari environment (read-only)" />
          <div className="space-y-3">
            {[
              ["Alert harga", "DISCORD_SIGNAL_CHANNEL_ID", true],
              ["Sinyal beli/jual", "DISCORD_SIGNAL_CHANNEL_ID", true],
              ["Berita & ringkasan AI", "DISCORD_NEWS_CHANNEL_ID", true],
              ["Laporan sistem", "DISCORD_ADMIN_CHANNEL_ID", true],
            ].map(([label, envKey, ok]) => (
              <div key={label as string} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                <div>
                  <span>{label}</span>
                  <p className="text-[11px] text-muted-foreground">{envKey}</p>
                </div>
                <Badge tone={ok ? "success" : "muted"}>env</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Risk Management" subtitle="Diterapkan ke semua strategi aktif (guardrail default sangat konservatif)" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { key: "stopLossPct", label: "Stop Loss (%)" },
            { key: "takeProfitPct", label: "Take Profit (%)" },
            { key: "riskPerPositionPct", label: "Risk per Posisi (%)" },
            { key: "dailyLossLimitPct", label: "Daily Loss Limit (%)" },
            { key: "maxPositions", label: "Max Posisi" },
          ].map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{field.label}</label>
              <input
                type="number"
                className="input"
                value={risk[field.key as keyof typeof risk]}
                onChange={(e) => setRisk((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="btn-ghost"
            disabled={isPending}
            onClick={() =>
              setRisk({
                stopLossPct: initial.risk.stopLoss,
                takeProfitPct: initial.risk.takeProfit,
                riskPerPositionPct: initial.risk.riskPerPosition,
                dailyLossLimitPct: initial.risk.dailyLossLimit,
                maxPositions: initial.risk.maxPositions,
              })
            }
          >
            Batal
          </button>
          <button className="btn-primary" disabled={isPending} onClick={() => run(() => updateRiskAction(risk))}>
            {isPending ? "Menyimpan…" : "Simpan Pengaturan"}
          </button>
        </div>
      </Card>
    </div>
  );
}
