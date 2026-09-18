import { Card, CardHeader, Table, Badge } from "@/components/ui";
import { SignalBadge } from "@/components/SignalBadge";
import { MOCK_SIGNALS } from "@/lib/mock";
import { formatIDR, formatDate, formatTime } from "@/lib/format";

export default function SignalsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sinyal</h1>
          <p className="text-sm text-muted-foreground">
            Semua sinyal beli/jual/watch dari engine analisis
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost">Teknikal</button>
          <button className="btn-ghost">Fundamental</button>
          <button className="btn-ghost">AI</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {MOCK_SIGNALS.map((s) => (
          <Card key={s.id}>
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
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Riwayat Sinyal" subtitle="7 hari terakhir" />
        <Table headers={["Tanggal", "Ticker", "Arah", "Sumber", "Alasan", "Harga", "Status"]}>
          {MOCK_SIGNALS.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(s.createdAt)}</td>
              <td className="px-3 py-2 font-medium">{s.ticker}</td>
              <td className="px-3 py-2"><SignalBadge direction={s.direction} /></td>
              <td className="px-3 py-2"><Badge tone="info">{s.source}</Badge></td>
              <td className="px-3 py-2 text-muted-foreground">{s.reason}</td>
              <td className="px-3 py-2">{formatIDR(s.price)}</td>
              <td className="px-3 py-2"><Badge tone="success">NOTIFIED</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}