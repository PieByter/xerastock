import Link from "next/link";
import { Card, CardHeader, Table, Badge } from "@/components/ui";
import { SignalBadge, ChangePct } from "@/components/SignalBadge";
import { ForeignNet } from "@/components/ForeignNet";
import { getQuotes } from "@/lib/data";
import { formatCompact, formatIDR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const quotes = await getQuotes();

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
          subtitle={`${quotes.length} saham · notifikasi aktif`}
          action={<Badge tone="success">Aktif</Badge>}
        />
        <Table headers={["Ticker", "Nama", "Harga", "Perubahan", "Volume", "Net Asing", "RSI", "Sinyal", ""]}>
          {quotes.map((q) => (
            <tr key={q.ticker}>
              <td className="px-3 py-2">
                <Link href={`/stock/${q.ticker}`} className="font-medium hover:text-primary">
                  {q.ticker}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{q.name}</td>
              <td className="px-3 py-2 font-medium">{formatIDR(q.price)}</td>
              <td className="px-3 py-2"><ChangePct value={q.changePct} /></td>
              <td className="px-3 py-2 text-muted-foreground">{formatCompact(q.volume)}</td>
              <td className="px-3 py-2 text-right"><ForeignNet value={q.foreignNet1d} /></td>
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