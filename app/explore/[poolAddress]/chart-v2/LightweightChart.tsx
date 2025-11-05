"use client";

import React, { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts";

export type Candle = { time: number; open: number; high: number; low: number; close: number };

export interface LightweightChartHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

interface Props {
  height?: number;
  theme?: "light" | "dark";
  candles: Candle[];
}

const LightweightChart = forwardRef<LightweightChartHandle, Props>(function LightweightChart(
  { height = 420, theme = "dark", candles },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (chartRef.current) {
        chartRef.current.timeScale().scrollBy(-10);
      }
    },
    zoomOut: () => {
      if (chartRef.current) {
        chartRef.current.timeScale().scrollBy(10);
      }
    },
    fit: () => {
      if (chartRef.current && candles.length > 0) {
        chartRef.current.timeScale().fitContent();
      }
    },
  }), [candles.length]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: theme === "dark" ? "#08111f" : "#ffffff" },
        textColor: theme === "dark" ? "#9ca3af" : "#374151",
      },
      grid: {
        vertLines: { color: theme === "dark" ? "#374151" : "#d1d5db", visible: true, style: 1 },
        horzLines: { color: theme === "dark" ? "#374151" : "#d1d5db", visible: true, style: 1 },
      },
      rightPriceScale: {
        borderColor: theme === "dark" ? "#374151" : "#d1d5db",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: theme === "dark" ? "#374151" : "#d1d5db",
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: theme === "dark" ? "#374151" : "#d1d5db",
        },
        horzLine: {
          color: theme === "dark" ? "#374151" : "#d1d5db",
        },
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, theme]);

  // Update data when candles change
  useEffect(() => {
    if (!seriesRef.current || !candles || candles.length === 0) return;

    const formattedData: CandlestickData<Time>[] = candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(formattedData);
    
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles]);

  const borderColor = theme === "dark" ? "#374151" : "#d1d5db";
  
  return (
    <div
      className="w-full relative"
      style={{ 
        height,
        borderRight: `1px solid ${borderColor}`,
      }}
    >
      <div
        ref={containerRef}
        className="w-full"
        style={{ height }}
      />
    </div>
  );
});

export default LightweightChart;



