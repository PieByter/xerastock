import { Card, CardHeader, Badge, StatCard, Table } from "@/components/ui";
import { getHealth } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function sourceTone(source: string | null): "success" | "warning" | "muted" {
  if (!source) return "muted";
  return source.includes("sample") ? "warning" : "success";
}

function sourceLabel(source: string | null): string {
  if (!source) return "belum ada";
  return source;
}

export default async function HealthPage() {
  const health = await getHealth();
  const sampleBroker = health.totals.brokerSampleRows;
  const realBroker = health.totals.brokerRealRows;
  const brokerRatio = health.totals.brokerRows > 0 ? (realBroker / health.totals.brokerRows) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Health & Data Source</h1>
          <p className="text-sm text-muted-foreground">
            Status sinkronisasi dan asal data per saham — pastikan bukan data contoh sebelum mengambil keputusan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={health.dbAvailable ? "success" : "danger"}>
            {health.dbAvailable ? "database terhubung" : "database tidak tersedia"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(health.generatedAt)} · {formatTime(health.generatedAt)}
          </span>
        </div>
      </div>

      {!health.dbAvailable && (
        <Card>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Set <code>DATABASE_URL</code> untuk melihat status sinkronisasi. Halaman ini tidak memakai data contoh.
          </p>
        </Card>
      )}

      {health.dbAvailable && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Saham aktif"
              value={String(health.stocks.length)}
              sub={`${health.stocks.filter((stock) => stock.barCount > 0).length} punya data harga`}
            />
            <StatCard
              label="Broker summary asli"
              value={`${realBroker}`}
              sub={`${sampleBroker} baris masih sample · ${brokerRatio.toFixed(0)}% asli`}
              tone={sampleBroker > 0 ? "danger" : "success"}
            />
            <StatCard
              label="Corporate action"
              value={String(health.totals.corporateActions)}
              sub={`${health.totals.corporateActionSamples} berasal dari data contoh`}
              tone={health.totals.corporateActionSamples > 0 ? "danger" : "success"}
            />
            <StatCard
              label="Outbox notifikasi"
              value={`${health.outbox.queued} antre`}
              sub={`${health.outbox.sent} terkirim · ${health.outbox.failed} gagal`}
              tone={health.outbox.failed > 0 ? "danger" : "success"}
            />
          </div>

          <Card>
            <CardHeader
              title="Sumber Data per Saham"
              subtitle="Harga, fundamental, broker summary, berita, dan sinyal terakhir"
            />
            <Table headers={["Ticker", "Bar harga", "Harga terakhir", "Fundamental", "Broker", "Berita", "Sinyal"]}>
              {health.stocks.map((stock) => (
                <tr key={stock.ticker}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{stock.ticker}</p>
                    <p className="text-[11px] text-muted-foreground">{stock.name}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{stock.barCount}</td>
                  <td className="px-3 py-2">
                    <p>{stock.lastBarDate ?? "—"}</p>
                    <Badge tone={sourceTone(stock.lastBarSource)}>{sourceLabel(stock.lastBarSource)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <p>{stock.fundamentalDate ?? "—"}</p>
                    <Badge tone={sourceTone(stock.fundamentalSource)}>{sourceLabel(stock.fundamentalSource)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <p>{stock.lastBrokerDate ?? "—"}</p>
                    <Badge tone={sourceTone(stock.lastBrokerSource)}>{sourceLabel(stock.lastBrokerSource)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{stock.lastNewsDate ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{stock.lastSignalDate ?? "—"}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card>
            <CardHeader title="Cara Membaca" subtitle="Sumber data dan arti statusnya" />
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Badge tone="success">yahoo</Badge> / <Badge tone="success">sectors</Badge> /{" "}
                <Badge tone="success">idx</Badge> — data dari provider eksternal (bukan sintetis).
              </li>
              <li>
                <Badge tone="warning">sample</Badge> — data contoh deterministik. Jangan dipakai untuk keputusan
                trading; isi <code>BROKER_API_URL</code> atau <code>SECTORS_API_KEY</code> lalu jalankan job broker
                sync.
              </li>
              <li>
                <Badge tone="muted">belum ada</Badge> — belum tersinkron. Jalankan worker atau{" "}
                <code>npm run fundamentals:sync</code> untuk fundamental.
              </li>
              <li>
                Corporate action dengan judul mengandung “data contoh” berasal dari provider sample; atur{" "}
                <code>CORPORATE_ACTION_PROVIDER=idx</code> untuk mencoba kalender resmi IDX.
              </li>
              <li>
                Outbox gagal &gt; 0 biasanya berarti channel Discord/Telegram belum dikonfigurasi atau token
                kedaluwarsa.
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
