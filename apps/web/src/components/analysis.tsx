import { Badge, Card, CardHeader, MiniStat } from "@/components/ui";
import {
    FLOW_TREND_LABEL,
    type ForeignFlowView,
    type LevelView,
    type LevelsView,
    type StockStatsView,
} from "@/lib/brokerAnalysis";
import { cn, formatCompact, formatIDR, formatPct } from "@/lib/format";

/** Rentang 52 minggu + posisi harga terakhir di dalamnya. */
export function RangeCard({ stats, price }: { stats: StockStatsView; price: number }) {
    return (
        <Card>
            <p className="text-xs text-muted-foreground">Rentang 52 Minggu</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
                {formatIDR(stats.low52w)} – {formatIDR(stats.high52w)}
            </p>
            <div className="relative mt-4 h-1.5 rounded-full bg-muted">
                <span
                    className="absolute inset-y-0 left-0 rounded-full bg-primary/40"
                    style={{ width: `${stats.rangePosition * 100}%` }}
                />
                <span
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
                    style={{ left: `${stats.rangePosition * 100}%` }}
                />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
                {formatIDR(price)} · {formatPct(stats.pctFromHigh)} dari puncak 52 minggu
            </p>
        </Card>
    );
}

/** Perubahan harga per periode (1 minggu s/d 1 tahun). */
export function ReturnsCard({ returns }: { returns: { label: string; value: number }[] }) {
    return (
        <Card>
            <CardHeader title="Imbal Hasil" subtitle="Perubahan harga per periode" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {returns.map((item) => (
                    <div key={item.label} className="rounded-lg bg-muted/60 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                        <p
                            className={cn(
                                "mt-0.5 text-sm font-semibold tabular-nums",
                                item.value >= 0 ? "text-success" : "text-danger",
                            )}
                        >
                            {formatPct(item.value)}
                        </p>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function LevelRow({ level, tone }: { level: LevelView; tone: "success" | "danger" }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
                <Badge tone={tone}>{level.touches}x</Badge>
                <span className="font-medium tabular-nums">{formatIDR(level.price)}</span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{formatPct(level.distancePct)}</span>
        </div>
    );
}

/** Level support/resistance hasil deteksi swing point. */
export function LevelsCard({ levels, price }: { levels: LevelsView; price: number }) {
    const empty = levels.supports.length === 0 && levels.resistances.length === 0;

    return (
        <Card>
            <CardHeader title="Support & Resistance" subtitle="Level dari swing high/low 120 hari bursa" />
            {empty ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                    Belum cukup data harga untuk mendeteksi level.
                </p>
            ) : (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">Resistance</p>
                        {levels.resistances.length > 0 ? (
                            levels.resistances.map((level) => (
                                <LevelRow key={level.price} level={level} tone="danger" />
                            ))
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Tidak ada resistance di atas harga — harga sedang di puncak rentang.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5">
                        <span className="text-xs font-medium">Harga terakhir</span>
                        <span className="text-sm font-semibold tabular-nums">{formatIDR(price)}</span>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">Support</p>
                        {levels.supports.length > 0 ? (
                            levels.supports.map((level) => (
                                <LevelRow key={level.price} level={level} tone="success" />
                            ))
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Tidak ada support di bawah harga — harga sedang di dasar rentang.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}

/** Ringkasan tren net foreign flow (PRD 4.3). */
export function FlowTrendSummary({ flow }: { flow: ForeignFlowView }) {
    const tone = flow.trend === "ACCUMULATION" ? "success" : flow.trend === "DISTRIBUTION" ? "danger" : "muted";

    return (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Tren asing</p>
                <p className="mt-1">
                    <Badge tone={tone}>{FLOW_TREND_LABEL[flow.trend]}</Badge>
                </p>
            </div>
            <MiniStat
                label="Net 5 hari"
                value={formatIDR(flow.net5d, true)}
                tone={flow.net5d >= 0 ? "success" : "danger"}
            />
            <MiniStat
                label="Net 20 hari"
                value={formatIDR(flow.net20d, true)}
                tone={flow.net20d >= 0 ? "success" : "danger"}
            />
            <MiniStat
                label="Net kumulatif"
                value={formatIDR(flow.cumulativeNet, true)}
                hint={`${flow.tradingDays} hari bursa`}
                tone={flow.cumulativeNet >= 0 ? "success" : "danger"}
            />
        </div>
    );
}

/** Statistik likuiditas & volatilitas untuk halaman detail saham. */
export function VolumeVolatilityPanel({ stats }: { stats: StockStatsView }) {
    return (
        <Card>
            <CardHeader title="Likuiditas & Volatilitas" subtitle="Berbasis 20 hari bursa terakhir" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat
                    label="Volume vs rata-rata"
                    value={`${stats.volumeRatio.toFixed(2)}x`}
                    hint={`avg20 ${formatCompact(stats.avgVolume20)}`}
                    tone={stats.volumeRatio >= 1.5 ? "success" : "default"}
                />
                <MiniStat label="Volume terakhir" value={formatCompact(stats.lastVolume)} />
                <MiniStat label="Volatilitas (annualisasi)" value={`${stats.volatility20.toFixed(1)}%`} />
                <MiniStat
                    label="Drawdown maksimum"
                    value={`${stats.maxDrawdown.toFixed(1)}%`}
                    tone="danger"
                />
            </div>
        </Card>
    );
}
