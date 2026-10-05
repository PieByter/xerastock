import Link from "next/link";
import { Card, CardHeader, StatCard, Table, Badge } from "@/components/ui";
import BrokerSummaryPanel from "@/components/BrokerSummaryPanel";
import ForeignFlowChart from "@/components/ForeignFlowChart";
import { ForeignNet } from "@/components/ForeignNet";
import { ChangePct } from "@/components/SignalBadge";
import { getQuotes, getStockDetail } from "@/lib/data";
import { resolveBrokerPeriod } from "@/lib/brokerAnalysis";
import { formatIDR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BrokerFlowPage({
  searchParams,
}: {
  searchParams: { ticker?: string; broker?: string };
}) {
  const quotes = await getQuotes();
  const ranked = [...quotes].sort((a, b) => b.foreignNet1d - a.foreignNet1d);
  const buyers = ranked.filter((q) => q.foreignNet1d > 0);
  const sellers = ranked.filter((q) => q.foreignNet1d < 0).reverse();
  const totalNet = quotes.reduce((sum, q) => sum + q.foreignNet1d, 0);

  const selected = (searchParams.ticker ?? ranked[0]?.ticker ?? "").toUpperCase();
  const period = resolveBrokerPeriod(searchParams.broker);
  const detail = selected ? await getStockDetail(selected, { brokerPeriod: period }) : null;

  const periodHref = (key: string) =>
    `/broker-flow?ticker=${encodeURIComponent(selected)}&broker=${key}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Broker Flow</h1>
          <p className="text-sm text-muted-foreground">
            Bandarmology: net asing harian, broker teraktif, dan tren akumulasi/distribusi
          </p>
        </div>
        {detail?.isDemo && <Badge tone="warning">Data contoh</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Net Asing"
          value={formatIDR(totalNet, true)}
          sub="sesi terakhir"
          tone={totalNet >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Net Buy Terbesar"
          value={buyers[0]?.ticker ?? "—"}
          sub={buyers[0] ? formatIDR(buyers[0].foreignNet1d, true) : "belum ada"}
          tone="success"
        />
        <StatCard
          label="Net Sell Terdalam"
          value={sellers[0]?.ticker ?? "—"}
          sub={sellers[0] ? formatIDR(sellers[0].foreignNet1d, true) : "belum ada"}
          tone="danger"
        />
        <StatCard
          label="Saham Akumulasi"
          value={`${buyers.length}/${quotes.length}`}
          sub="net asing positif"
        />
      </div>

      <Card>
        <CardHeader
          title="Peringkat Net Foreign Flow"
          subtitle="Klik ticker untuk melihat detail broker summary & tren akumulasi"
        />
        <Table headers={["#", "Ticker", "Harga", "Perubahan", "Net Asing (1D)", "Analisis"]}>
          {ranked.map((q, i) => (
            <tr key={q.ticker} className={q.ticker === selected ? "bg-primary/5" : undefined}>
              <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/broker-flow?ticker=${encodeURIComponent(q.ticker)}`}
                  className="font-medium hover:text-primary"
                >
                  {q.ticker}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">{formatIDR(q.price)}</td>
              <td className="px-3 py-2">
                <ChangePct value={q.changePct} />
              </td>
              <td className="px-3 py-2 text-right">
                <ForeignNet value={q.foreignNet1d} />
              </td>
              <td className="px-3 py-2">
                <Link href={`/stock/${q.ticker}`} className="text-xs text-primary hover:underline">
                  Detail saham →
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {detail && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BrokerSummaryPanel summary={detail.brokerSummary} periodHref={periodHref} />
          <Card>
            <CardHeader
              title={`Net Foreign Flow — ${selected}`}
              subtitle="Bar = net harian, garis = net kumulatif"
              action={
                <Link href={`/stock/${selected}`} className="text-xs text-primary hover:underline">
                  Halaman saham →
                </Link>
              }
            />
            {detail.foreignFlow && detail.foreignFlow.points.length > 0 ? (
              <ForeignFlowChart points={detail.foreignFlow.points} height={280} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Belum ada data foreign flow untuk saham ini.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
