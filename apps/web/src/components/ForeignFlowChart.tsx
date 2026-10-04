"use client";

import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";

export interface FlowPoint {
    date: string;
    net: number;
    cumulative: number;
}

interface Props {
    points: FlowPoint[];
    height?: number;
}

const UP_COLOR = "rgba(34,197,94,0.55)";
const DOWN_COLOR = "rgba(239,68,68,0.55)";

/**
 * Net foreign flow: bar = net harian, garis = net kumulatif.
 * Garis kumulatif yang menanjak menandakan fase akumulasi asing.
 */
export default function ForeignFlowChart({ points, height = 260 }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const netRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const cumulativeRef = useRef<ISeriesApi<"Line"> | null>(null);

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
            leftPriceScale: { visible: false },
            crosshair: { mode: 0 },
        });

        // Net harian dipetakan ke skala kiri dan dikecilkan agar muat di bawah garis kumulatif.
        const net = chart.addHistogramSeries({ priceScaleId: "left", priceLineVisible: false });
        chart.priceScale("left").applyOptions({ scaleMargins: { top: 0.72, bottom: 0 } });

        const cumulative = chart.addLineSeries({
            color: "#3b82f6",
            lineWidth: 2,
            priceLineVisible: false,
        });

        chartRef.current = chart;
        netRef.current = net;
        cumulativeRef.current = cumulative;

        return () => {
            chart.remove();
            chartRef.current = null;
            netRef.current = null;
            cumulativeRef.current = null;
        };
    }, [height]);

    useEffect(() => {
        if (!netRef.current || !cumulativeRef.current || points.length === 0) return;

        netRef.current.setData(
            points.map((p) => ({
                time: p.date,
                value: p.net,
                color: p.net >= 0 ? UP_COLOR : DOWN_COLOR,
            })) as never,
        );
        cumulativeRef.current.setData(points.map((p) => ({ time: p.date, value: p.cumulative })) as never);
        chartRef.current?.timeScale().fitContent();
    }, [points]);

    return <div ref={containerRef} className="w-full" />;
}
