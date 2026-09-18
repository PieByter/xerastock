"use client";

import { useState } from "react";
import { Card, CardHeader, Badge } from "@/components/ui";

export default function SettingsPage() {
  const [mode, setMode] = useState("SIGNAL_ONLY");
  const [risk, setRisk] = useState({ stopLoss: 5, takeProfit: 10, riskPerPos: 1, dailyLoss: 2, maxPos: 5 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          Konfigurasi bot, strategi, dan notifikasi
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Mode Bot" subtitle="SIGNAL_ONLY → PAPER → LIVE (Fase 3)" />
          <div className="flex gap-2">
            {["SIGNAL_ONLY", "PAPER", "LIVE"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`btn ${mode === m ? "btn-primary" : "btn-ghost"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {mode === "SIGNAL_ONLY" && "Bot hanya menghasilkan sinyal & notifikasi. Tidak ada eksekusi."}
            {mode === "PAPER" && "Trade disimulasikan dengan saldo virtual. Aman untuk uji strategi."}
            {mode === "LIVE" && "⚠️ Eksekusi order riil via broker. Butuh integrasi broker & konfirmasi."}
          </p>
        </Card>

        <Card>
          <CardHeader title="Notifikasi Discord" subtitle="Channel & preferensi" />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span>Alert harga</span>
              <Badge tone="success">Aktif</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span>Sinyal beli/jual</span>
              <Badge tone="success">Aktif</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span>Laporan harian (16:30 WIB)</span>
              <Badge tone="success">Aktif</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span>Notifikasi eksekusi trade</span>
              <Badge tone="warning">Mode PAPER</Badge>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Risk Management" subtitle="Guardrail trading — default sangat konservatif" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { key: "stopLoss", label: "Stop Loss (%)", value: risk.stopLoss },
            { key: "takeProfit", label: "Take Profit (%)", value: risk.takeProfit },
            { key: "riskPerPos", label: "Risk per Posisi (%)", value: risk.riskPerPos },
            { key: "dailyLoss", label: "Daily Loss Limit (%)", value: risk.dailyLoss },
            { key: "maxPos", label: "Max Posisi", value: risk.maxPos },
          ].map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{f.label}</label>
              <input
                type="number"
                className="input"
                value={f.value}
                onChange={(e) =>
                  setRisk((p) => ({ ...p, [f.key]: Number(e.target.value) }))
                }
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost">Batal</button>
          <button className="btn-primary">Simpan Pengaturan</button>
        </div>
      </Card>
    </div>
  );
}