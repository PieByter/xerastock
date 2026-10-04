import { cn, formatIDR } from "@/lib/format";

/**
 * Net foreign (beli - jual, Rp).
 * Nilai 0 atau kosong ditampilkan sebagai "—" supaya tidak terbaca sebagai netral.
 */
export function ForeignNet({ value, compact = true }: { value: number; compact?: boolean }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("font-medium tabular-nums", value >= 0 ? "text-success" : "text-danger")}>
      {formatIDR(value, compact)}
    </span>
  );
}
