import { Card, CardHeader, Table, Badge, StatCard } from "@/components/ui";
import { getBotOverview } from "@/lib/data";
import { formatIDR, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BotPage() {
  const bot = await getBotOverview();
  const running = bot.status === "RUNNING";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Bot & Trading</h1>
          <p className="text-sm text-muted-foreground">
            Monitoring bot Discord, paper trading, dan auto buy/sell
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost">Pause</button>
          <button className="btn-primary">Start Bot</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Mode" value={bot.mode} sub={running ? "Bot berjalan" : "Bot berhenti"} />
        <StatCard
          label="Saldo Paper"
          value={formatIDR(bot.balance)}
          sub={`Modal awal ${formatIDR(bot.initialBalance, true)}`}
        />
        <StatCard
          label="Posisi Terbuka"
          value={String(bot.openPositions)}
          sub={`dari max ${bot.risk.maxPositions}`}
        />
        <StatCard
          label="Kill Switch"
          value={bot.killSwitch ? "AKTIF" : "Aman"}
          sub={bot.killSwitch ? "trading dihentikan" : "guardrail aktif"}
          tone={bot.killSwitch ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Status Bot"
            subtitle="Discord bot & scheduler"
            action={<Badge tone={running ? "success" : "muted"}>● {running ? "Running" : "Stopped"}</Badge>}
          />
          <div className="space-y-3 text-sm">
            {[
              ["Trade Engine", `Mode ${bot.mode} · kill switch ${bot.killSwitch ? "AKTIF" : "nonaktif"}`, running && !bot.killSwitch],
              ["Posisi Terbuka", `${bot.openPositions} dari max ${bot.risk.maxPositions}`, true],
              ["Data Provider", "Yahoo Finance (+ Twelve Data opsional)", true],
              ["ML Sidecar", "Belum aktif (Fase 2)", false],
            ].map(([label, value, ok]) => (
              <div key={label as string} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{value}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-success" : "bg-muted"}`} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Risk Management" subtitle="Guardrail aktif (default konservatif)" />
          <div className="space-y-2 text-sm">
            {[
              ["Risk per posisi", `${bot.risk.riskPerPosition}%`],
              ["Stop loss", `${bot.risk.stopLoss}%`],
              ["Take profit", `${bot.risk.takeProfit}%`],
              ["Daily loss limit", `${bot.risk.dailyLossLimit}%`],
              ["Max posisi", String(bot.risk.maxPositions)],
              ["Kill switch", bot.killSwitch ? "AKTIF — /stop darurat" : "nonaktif"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Riwayat Trade" subtitle="Paper trading — eksekusi next-bar" />
        <Table headers={["Tanggal", "Ticker", "Side", "Qty", "Harga", "PnL", "Status"]}>
          {bot.trades.map((t) => (
            <tr key={t.id}>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(t.openedAt)}</td>
              <td className="px-3 py-2 font-medium">{t.ticker}</td>
              <td className="px-3 py-2">
                <Badge tone={t.side === "BUY" ? "success" : "danger"}>{t.side}</Badge>
              </td>
              <td className="px-3 py-2">{t.qty}</td>
              <td className="px-3 py-2">{formatIDR(t.price)}</td>
              <td className="px-3 py-2">
                {t.pnl == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className={t.pnl >= 0 ? "text-success" : "text-danger"}>
                    {t.pnl >= 0 ? "+" : ""}
                    {formatIDR(t.pnl)}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <Badge tone={t.status === "OPEN" ? "warning" : "muted"}>{t.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}