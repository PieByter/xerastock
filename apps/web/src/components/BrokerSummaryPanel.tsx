import Link from "next/link";
import { Badge, Card, CardHeader, MiniStat } from "@/components/ui";
import { BROKER_PERIODS, type BrokerPeriodKey, type BrokerSummaryView, type BrokerTableRow } from "@/lib/brokerAnalysis";
import { cn, formatCompact, formatDayString, formatIDR } from "@/lib/format";

function NetCell({ value, ratio }: { value: number; ratio: number }) {
    const positive = value >= 0;
    return (
        <div className="flex items-center justify-end gap-2">
            <span className={cn("font-medium tabular-nums", positive ? "text-success" : "text-danger")}>
                {formatIDR(value, true)}
            </span>
            <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                <span
                    className={cn("block h-full rounded-full", positive ? "bg-success" : "bg-danger")}
                    style={{ width: `${Math.max(ratio * 100, 4)}%` }}
                />
            </span>
        </div>
    );
}

function BrokerTable({
    title,
    subtitle,
    rows,
}: {
    title: string;
    subtitle: string;
    rows: BrokerTableRow[];
}) {
    return (
        <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div>
                    <p className="text-xs font-semibold">{title}</p>
                    <p className="text-[11px] text-muted-foreground">{subtitle}</p>
                </div>
                <Badge tone={rows.length > 0 ? "info" : "muted"}>{rows.length}</Badge>
            </div>
            {rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Tidak ada broker dengan net {title.toLowerCase()} pada periode ini.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                                <th className="px-3 py-2 font-medium">Broker</th>
                                <th className="px-3 py-2 text-right font-medium">Beli</th>
                                <th className="px-3 py-2 text-right font-medium">Jual</th>
                                <th className="px-3 py-2 text-right font-medium">Net</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((row) => (
                                <tr key={row.brokerCode}>
                                    <td className="px-3 py-2">
                                        <span className="flex items-center gap-2">
                                            <span className="font-medium">{row.brokerCode}</span>
                                            <span
                                                className={cn(
                                                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                                    row.investorType === "FOREIGN"
                                                        ? "bg-primary/15 text-primary"
                                                        : "bg-muted text-muted-foreground",
                                                )}
                                            >
                                                {row.investorType === "FOREIGN" ? "Asing" : "Lokal"}
                                            </span>
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {formatCompact(row.netVolume)} lembar · {row.days} hari
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                        {formatIDR(row.buyValue, true)}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                        {formatIDR(row.sellValue, true)}
                                    </td>
                                    <td className="px-3 py-2">
                                        <NetCell value={row.netValue} ratio={row.barRatio} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function concentrationTone(topShare: number): { label: string; tone: "success" | "warning" | "danger" } {
    if (topShare >= 0.6) return { label: "terkonsentrasi", tone: "danger" };
    if (topShare >= 0.4) return { label: "sedang", tone: "warning" };
    return { label: "tersebar", tone: "success" };
}

/**
 * Panel bandarmology: ringkasan net broker, top akumulator vs distributor,
 * highlight streak net buy, dan tingkat konsentrasi broker (PRD 4.3).
 *
 * `periodHref` dibuat pemanggil supaya pemilihan periode tidak menghapus
 * parameter lain di URL (mis. rentang chart).
 */
export default function BrokerSummaryPanel({
    summary,
    periodHref,
}: {
    summary: BrokerSummaryView | null;
    periodHref: (period: BrokerPeriodKey) => string;
}) {
    if (!summary) {
        return (
            <Card>
                <CardHeader
                    title="Broker Summary"
                    subtitle="Bandarmology — akumulasi & distribusi broker"
                />
                <p className="py-8 text-center text-sm text-muted-foreground">
                    Belum ada data broker summary untuk saham ini.
                    <br />
                    <span className="text-xs">
                        Isi tabel <code>broker_summary</code> lewat job scraper, lalu muat ulang halaman.
                    </span>
                </p>
            </Card>
        );
    }

    const { balance, concentration } = summary;
    const concentrationInfo = concentrationTone(concentration.topShare);

    return (
        <Card>
            <CardHeader
                title="Broker Summary"
                subtitle={`${summary.totalBrokers} broker · ${summary.tradingDays} hari bursa s/d ${formatDayString(summary.date)}`}
                action={
                    <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                        {BROKER_PERIODS.map((period) => (
                            <Link
                                key={period.key}
                                href={periodHref(period.key)}
                                className={cn(
                                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                                    period.key === summary.period
                                        ? "bg-primary text-white"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {period.label}
                            </Link>
                        ))}
                    </div>
                }
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <MiniStat label="Total Beli" value={formatIDR(balance.totalBuyValue, true)} />
                <MiniStat label="Total Jual" value={formatIDR(balance.totalSellValue, true)} />
                <MiniStat
                    label="Net"
                    value={formatIDR(balance.netValue, true)}
                    tone={balance.netValue >= 0 ? "success" : "danger"}
                />
                <MiniStat
                    label="Net Asing"
                    value={formatIDR(balance.foreignNetValue, true)}
                    tone={balance.foreignNetValue >= 0 ? "success" : "danger"}
                />
                <MiniStat
                    label="Net Lokal"
                    value={formatIDR(balance.localNetValue, true)}
                    tone={balance.localNetValue >= 0 ? "success" : "danger"}
                />
            </div>

            {summary.streaks.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold">Broker akumulasi beruntun</p>
                    <div className="flex flex-wrap gap-2">
                        {summary.streaks.map((streak) => (
                            <span
                                key={`${streak.brokerCode}-${streak.until}`}
                                className="badge bg-success/15 text-success"
                            >
                                {streak.brokerCode} net buy {streak.days} hari · {formatIDR(streak.netValue, true)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <BrokerTable
                    title="Top Net Buy (akumulasi)"
                    subtitle={`${summary.periodLabel} · peringkat berdasarkan net beli`}
                    rows={summary.buyers}
                />
                <BrokerTable
                    title="Top Net Sell (distribusi)"
                    subtitle={`${summary.periodLabel} · peringkat berdasarkan net jual`}
                    rows={summary.sellers}
                />
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Konsentrasi broker</span>
                    <Badge tone={concentrationInfo.tone}>{concentrationInfo.label}</Badge>
                </div>
                <div className="flex items-center gap-3">
                    <span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(concentration.meterRatio * 100, 2)}%` }}
                        />
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                        top-{concentration.topBrokers} {(concentration.topShare * 100).toFixed(1)}% · HHI{" "}
                        {(concentration.hhi * 100).toFixed(1)}
                    </span>
                </div>
            </div>
        </Card>
    );
}
