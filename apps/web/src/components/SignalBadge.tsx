import { Badge } from "@/components/ui";
import { cn } from "@/lib/format";

export function SignalBadge({ direction }: { direction: "BUY" | "SELL" | "WATCH" | "NONE" }) {
  const tone =
    direction === "BUY"
      ? "success"
      : direction === "SELL"
        ? "danger"
        : direction === "WATCH"
          ? "warning"
          : "muted";
  return <Badge tone={tone}>{direction}</Badge>;
}

export function ChangePct({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={cn("font-medium", positive ? "text-success" : "text-danger")}>
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}