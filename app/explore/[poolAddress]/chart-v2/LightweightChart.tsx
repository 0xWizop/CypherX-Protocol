"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createChart, IChartApi } from "lightweight-charts";

type CandlestickPoint = { time: number; open: number; high: number; low: number; close: number };
type LinePoint = { time: number; value: number };

interface LightweightChartProps {
  height?: number;
  theme?: "dark" | "light";
  candles?: CandlestickPoint[];
  line?: LinePoint[];
}

export type LightweightChartHandle = {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

const LightweightChart = forwardRef<LightweightChartHandle, LightweightChartProps>(function LC(
  { height = 520, theme = "dark", candles = [], line = [] },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const firstTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const candleSeriesRef = useRef<any | null>(null);
  const lineSeriesRef = useRef<any | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const backgroundColor = theme === "dark" ? "#0b1020" : "#ffffff";
    const textColor = theme === "dark" ? "#cbd5e1" : "#111827";

    const chart = createChart(containerRef.current, {
      layout: { background: { type: "solid", color: backgroundColor }, textColor },
      grid: {
        vertLines: { color: theme === "dark" ? "#1f2937" : "#e5e7eb" },
        horzLines: { color: theme === "dark" ? "#1f2937" : "#e5e7eb" },
      },
      rightPriceScale: {
        borderColor: theme === "dark" ? "#1f2937" : "#e5e7eb",
        visible: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        entireTextOnly: true,
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: theme === "dark" ? "#1f2937" : "#e5e7eb",
        fixLeftEdge: false,
        fixRightEdge: false,
        rightOffset: 4,
        barSpacing: 6,
        lockVisibleTimeRangeOnResize: false,
        secondsVisible: true,
      },
      crosshair: { mode: 0 },
      localization: {
        priceFormatter: (p: number) => (p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(6)}`),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => chart.applyOptions({}));
    resizeObserver.observe(containerRef.current);

    const candleSeries = (chart as any).addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#ef4444",
      wickUpColor: "#16a34a",
      wickDownColor: "#ef4444",
      borderVisible: false,
      priceScaleId: "right",
    });
    candleSeriesRef.current = candleSeries;

    if (line.length > 0) {
      const lineSeries = (chart as any).addAreaSeries({
        lineColor: "#60a5fa",
        topColor: "rgba(96,165,250,0.25)",
        bottomColor: "rgba(96,165,250,0.05)",
        priceScaleId: "right",
      });
      lineSeries.setData(line);
      lineSeriesRef.current = lineSeries;
    }

    chart.timeScale().fitContent();

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [theme, height]);

  // Update candles without re-creating chart or changing viewport
  useEffect(() => {
    const cs = candleSeriesRef.current;
    if (!cs) return;
    if (!candles || candles.length === 0) {
      cs.setData([]);
      firstTimeRef.current = null;
      lastTimeRef.current = null;
      return;
    }
    cs.setData(candles);
    firstTimeRef.current = candles[0]?.time ?? null;
    lastTimeRef.current = candles[candles.length - 1]?.time ?? null;
  }, [candles]);

  // Update optional line series
  useEffect(() => {
    const ls = lineSeriesRef.current;
    if (!ls) return;
    if (!line || line.length === 0) {
      ls.setData([]);
      return;
    }
    ls.setData(line);
  }, [line]);

  useImperativeHandle(ref, () => ({
    fit: () => {
      chartRef.current?.timeScale().fitContent();
    },
    zoomIn: () => {
      const scale = chartRef.current?.timeScale();
      if (!scale || firstTimeRef.current == null || lastTimeRef.current == null) return;
      const range: any = scale.getVisibleRange?.();
      if (range && range.from != null && range.to != null) {
        const mid = (range.from + range.to) / 2;
        const half = (range.to - range.from) / 4; // zoom in 2x
        scale.setVisibleRange?.({ from: mid - half, to: mid + half });
      }
    },
    zoomOut: () => {
      const scale = chartRef.current?.timeScale();
      if (!scale || firstTimeRef.current == null || lastTimeRef.current == null) return;
      const range: any = scale.getVisibleRange?.();
      if (range && range.from != null && range.to != null) {
        const mid = (range.from + range.to) / 2;
        const half = (range.to - range.from) / 2; // zoom out 2x
        scale.setVisibleRange?.({ from: mid - half, to: mid + half });
      } else {
        scale.fitContent();
      }
    },
  }), []);

  return (
    <div className="w-full h-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

export default LightweightChart;


