import Link from "next/link";
import { Card, CardHeader, Table, Badge } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import { MOCK_QUOTES } from "@/lib/mock";
import { formatIDR } from "@/lib/format";

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Watchlist</h1>
          <p className="text-sm text-muted-foreground">
            Pantau saham favorit — alert harga & sinyal otomatis ke Discord
          </p>
        </div>
        <button className="btn-primary">+ Tambah Saham</button>
      </div>

      <Card>
        <CardHeader
          title="Watchlist Utama"
          subtitle="8 saham · notifikasi aktif"
          action={<Badge tone="success">Aktif</Badge>}
        />
        <Table headers={["Ticker", "Nama", "Harga", "Perubahan", "Volume", "RSI", "Sinyal", ""]}>
          {MOCK_QUOTES.map((q) => (
            <tr key={q.ticker}>
              <td className="px-3 py-2">
                <Link href={`/stock/${q.ticker}`} className="font-medium hover:text-primary">
                  {q.ticker}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{q.name}</td>
              <td className="px-3 py-2 font-medium">{formatIDR(q.price)}</td>
              <td className="px-3 py-2"><ChangePct value={q.changePct} /></td>
              <td className="px-3 py-2 text-muted-foreground">
                {(q.volume / 1_000_000).toFixed(1)}jt
              </td>
              <td className="px-3 py-2">{q.rsi.toFixed(1)}</td>
              <td className="px-3 py-2"><SignalBadge direction={q.signal} /></td>
              <td className="px-3 py-2 text-right">
                <Link href={`/stock/${q.ticker}`} className="text-xs text-primary hover:underline">
                  Detail
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}