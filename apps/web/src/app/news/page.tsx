import Link from "next/link";
import { Card, CardHeader, Badge } from "@/components/ui";
import { getCorporateActions, getNews, getNewsTickers } from "@/lib/data";
import { cn, formatDate, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const SENTIMENT_LABEL = {
  POSITIVE: { label: "Positif", dot: "bg-success" },
  NEUTRAL: { label: "Netral", dot: "bg-warning" },
  NEGATIVE: { label: "Negatif", dot: "bg-danger" },
} as const;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { ticker?: string };
}) {
  const ticker = searchParams.ticker?.toUpperCase();
  const [news, tickers, corporateActions] = await Promise.all([
    getNews(30, ticker),
    getNewsTickers(),
    getCorporateActions(30),
  ]);
  const isDemo = news.some((n) => n.isDemo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">News</h1>
          <p className="text-sm text-muted-foreground">
            Berita pasar & emiten dengan ringkasan dan sentimen otomatis
          </p>
        </div>
        {isDemo && <Badge tone="warning">Data contoh</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Link
          href="/news"
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs transition-colors",
            !ticker ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Semua
        </Link>
        {tickers.map((t) => (
          <Link
            key={t}
            href={`/news?ticker=${encodeURIComponent(t)}`}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs transition-colors",
              ticker === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {news.length === 0 ? (
            <Card>
              <p className="py-10 text-center text-sm text-muted-foreground">
                Belum ada berita{ticker ? ` untuk ${ticker}` : ""}.
              </p>
            </Card>
          ) : (
            news.map((item) => {
              const sentiment = SENTIMENT_LABEL[item.aiSentiment];
              return (
                <Card key={item.id}>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", sentiment.dot)} />
                      <span className="font-medium text-foreground">{item.source}</span>
                      <span>· {sentiment.label}</span>
                    </div>
                    <span title={new Date(item.publishedAt).toLocaleString("id-ID")}>
                      {timeAgo(item.publishedAt)}
                    </span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-sm font-semibold leading-snug hover:text-primary"
                  >
                    {item.title}
                  </a>
                  <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-primary">✦ Ringkasan AI: </span>
                    {item.aiSummary}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {item.relatedTickers.map((t) => (
                      <Link
                        key={t}
                        href={`/news?ticker=${encodeURIComponent(t)}`}
                        className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/20"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Kalender Corporate Action" subtitle="Cum-date 30 hari ke depan" />
            {corporateActions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada corporate action dalam 30 hari ke depan.
              </p>
            ) : (
              <div className="space-y-3">
                {corporateActions.map((ca) => (
                  <div key={ca.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/stock/${ca.ticker}`} className="text-sm font-medium hover:text-primary">
                        {ca.ticker}
                      </Link>
                      <Badge tone={ca.daysUntilCumDate <= 3 ? "warning" : "info"}>
                        {ca.daysUntilCumDate === 0 ? "HARI INI" : `H-${ca.daysUntilCumDate}`}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs font-medium">{ca.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Cum: {formatDate(ca.cumDate)} · Ex: {formatDate(ca.exDate)}
                      {ca.paymentDate ? ` · Bayar: ${formatDate(ca.paymentDate)}` : ""}
                    </p>
                    {ca.detail && <p className="mt-1 text-[11px] text-muted-foreground">{ca.detail}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Update Terakhir" subtitle="Waktu pengambilan data" />
            <p className="text-xs text-muted-foreground">
              {news[0]
                ? `${formatDate(news[0].publishedAt)} ${formatTime(news[0].publishedAt)} WIB`
                : "Belum ada data"}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Ringkasan AI bukan rekomendasi beli/jual — verifikasi berita aslinya sebelum mengambil keputusan.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
