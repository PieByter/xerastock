import { Card, CardHeader, Table, Badge, StatCard } from "@/components/ui";
import { MOCK_TRADES } from "@/lib/mock";
import { formatIDR, formatPct, formatDate } from "@/lib/format";

export default function BotPage() {
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
        <StatCard label="Mode" value="PAPER" sub="SIGNAL_ONLY → PAPER" />
        <StatCard label="Saldo Paper" value={formatIDR(10_000_000)} sub="Modal awal Rp 10jt" />
        <StatCard label="Posisi Terbuka" value="2" sub="dari max 5" />
        <StatCard label="PnL Hari Ini" value={formatPct(1.24)} sub="+Rp 124.000" tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Status Bot"
            subtitle="Discord bot & scheduler"
            action={<Badge tone="success">● Running</Badge>}
          />
          <div className="space-y-3 text-sm">
            {[
              ["Discord Bot", "Online · 10 slash commands", true],
              ["Scheduler EOD", "Next: 16:00 WIB", true],
              ["Quote Refresh", "Next: 5 menit lagi", true],
              ["Trade Engine", "Mode PAPER · guardrail aktif", true],
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
              ["Risk per posisi", "1%"],
              ["Stop loss", "5%"],
              ["Take profit", "10%"],
              ["Daily loss limit", "2%"],
              ["Max posisi", "5"],
              ["Kill switch", "Aktif — /stop darurat"],
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
          {MOCK_TRADES.map((t) => (
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