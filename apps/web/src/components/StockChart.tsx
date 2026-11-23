"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { cn } from "@/lib/format";

export interface ChartCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  candles: ChartCandle[];
  height?: number;
}

type Timeframe = "1D" | "1W";

/** Gabungkan candle harian menjadi candle mingguan (Senin–Jumat). */
export function aggregateWeekly(candles: ChartCandle[]): ChartCandle[] {
  const weeks = new Map<string, ChartCandle>();

  for (const candle of candles) {
    const date = new Date(`${candle.time}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);

    const existing = weeks.get(key);
    if (!existing) {
      weeks.set(key, { time: key, open: candle.open, high: candle.high, low: candle.low, close: candle.close });
    } else {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
    }
  }

  return [...weeks.values()];
}

/**
 * Candlestick chart (TradingView lightweight-charts) dengan switch timeframe
 * harian/mingguan. Agregasi mingguan dilakukan di client agar tidak perlu
 * query/endpoint tambahan.
 */
export default function StockChart({ candles, height = 380 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");

  const data = useMemo(
    () => (timeframe === "1W" ? aggregateWeekly(candles) : candles),
    [candles, timeframe],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.2)",
        timeVisible: false,
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.2)" },
      crosshair: { mode: 0 },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(data as never);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {data.length} candle {timeframe === "1W" ? "mingguan" : "harian"}
        </p>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {(["1D", "1W"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTimeframe(option)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                timeframe === option
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
