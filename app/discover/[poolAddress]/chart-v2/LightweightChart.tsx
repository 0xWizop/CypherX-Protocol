"use client";

import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState, useMemo, useCallback } from "react";
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time } from "lightweight-charts";

// Helper function to format market cap as "5.97M" style
const formatMarketCap = (value: number): string => {
  if (value === 0 || !isFinite(value)) return '0';
  
  const absValue = Math.abs(value);
  
  if (absValue >= 1e12) {
    return `${(value / 1e12).toFixed(2)}T`;
  } else if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`;
  } else {
    return value.toFixed(2);
  }
};

// Helper function to format price with commas for large numbers
const formatPriceWithCommas = (price: number, precision: number): string => {
  if (price === 0 || !isFinite(price)) return '0';
  
  // Use absolute value to remove minus sign
  const absPrice = Math.abs(price);
  
  // For large numbers (>= 1000), add commas
  if (absPrice >= 1000) {
    return absPrice.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }
  
  // For smaller numbers, use regular formatting
  return absPrice.toFixed(precision);
};

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export interface LightweightChartHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

interface Props {
  height?: number;
  theme?: "light" | "dark";
  candles: Candle[];
  priceScalePadding?: number;
  yAxisMode?: "price" | "marketCap";
  currentMarketCap?: number;
  currentPrice?: number;
  showVolume?: boolean;
  showMovingAverage?: boolean;
  movingAveragePeriod?: number;
  showVWAP?: boolean;
  showRSI?: boolean;
  showEMA?: boolean;
  timeframe?: string; // Add timeframe prop for VWAP reset logic
  indicatorColors?: {
    sma?: string;
    ema?: string;
    vwap?: string;
    rsi?: string;
  };
}

const LightweightChart = forwardRef<LightweightChartHandle, Props>(function LightweightChart(
  { height = 420, theme = "dark", candles, priceScalePadding = 0, yAxisMode = "price", currentMarketCap, currentPrice, showVolume = true, showMovingAverage = false, movingAveragePeriod = 20, showVWAP = false, showRSI = false, showEMA = false, timeframe = "1d", indicatorColors },
  ref
) {
  // Default colors with theme support
  const defaultColors = {
    sma: theme === "dark" ? "#3b82f6" : "#2563eb",
    ema: theme === "dark" ? "#a855f7" : "#9333ea",
    vwap: theme === "dark" ? "#f59e0b" : "#d97706",
    rsi: theme === "dark" ? "#ec4899" : "#db2777",
  };
  
  const colors = {
    sma: indicatorColors?.sma || defaultColors.sma,
    ema: indicatorColors?.ema || defaultColors.ema,
    vwap: indicatorColors?.vwap || defaultColors.vwap,
    rsi: indicatorColors?.rsi || defaultColors.rsi,
  };
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(height);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const originalCandlesRef = useRef<Candle[]>([]);
  const initialZoomSetRef = useRef<boolean>(false);

  useImperativeHandle(
    ref,
    () => {
      const adjustZoom = (factor: number) => {
        const scale = chartRef.current?.timeScale();
        if (!scale) return;
        const range = scale.getVisibleLogicalRange();
        if (!range) return;
        const span = range.to - range.from;
        if (!isFinite(span) || span <= 0) return;
        const minSpan = 5;
        const maxSpan = Math.max(candles.length || span, span);
        const newSpan = Math.min(Math.max(span * factor, minSpan), maxSpan);
        const right = range.to;
        const from = right - newSpan;
        const to = right;
        scale.setVisibleLogicalRange({ from, to });
      };

      return {
        zoomIn: () => adjustZoom(0.75),
        zoomOut: () => adjustZoom(1.25),
        fit: () => {
          if (chartRef.current && candles.length > 0) {
            chartRef.current.timeScale().fitContent();
          }
        },
      };
    },
    [candles.length, theme, seriesRef]
  );

  // Calculate container height for mobile
  useEffect(() => {
    if (!containerRef.current) return;
    if (height === undefined) {
      const updateHeight = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.height > 0) {
            setContainerHeight(rect.height);
          }
        }
      };
      // Initial height
      updateHeight();
      // Watch for resize
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    } else {
      setContainerHeight(height);
    }
  }, [height]);

  // Resize chart when container height changes
  useEffect(() => {
    if (chartRef.current && containerHeight > 0) {
      chartRef.current.applyOptions({ height: containerHeight });
    }
  }, [containerHeight]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current || containerHeight <= 0) return;

    const chart = createChart(containerRef.current, {
      height: containerHeight,
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
        scaleMargins: { top: 0.1, bottom: showVolume ? 0.25 : 0.1 }, // Reduced space for volume bars
        entireTextOnly: false,
        minimumWidth: 80,
        visible: true,
        autoScale: true,
        ticksVisible: true,
      },
      timeScale: {
        borderColor: theme === "dark" ? "#374151" : "#d1d5db",
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
      },
      crosshair: {
        mode: 1, // Normal mode with crosshair
        vertLine: {
          color: theme === "dark" ? "#3b82f6" : "#2563eb",
          width: 1,
          style: 0, // Solid
          labelBackgroundColor: theme === "dark" ? "#1e293b" : "#ffffff",
        },
        horzLine: {
          color: theme === "dark" ? "#3b82f6" : "#2563eb",
          width: 1,
          style: 0, // Solid
          labelBackgroundColor: theme === "dark" ? "#1e293b" : "#ffffff",
        },
      },
    });

    // Add candlestick series - lightweight-charts v5 uses addSeries with series definition
    const candlestickSeriesApi = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceScaleId: 'right',
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
    });

    // Add volume series if enabled
    let volumeSeries: ISeriesApi<"Histogram"> | null = null;
    if (showVolume) {
      volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        color: theme === "dark" ? "#3b82f680" : "#3b82f640",
      });
      volumeSeriesRef.current = volumeSeries;
      // Volume price scale will be configured in the data update effect
      // after data is set, ensuring the scale exists
    }

    chartRef.current = chart;
    seriesRef.current = candlestickSeriesApi;

    // Setup crosshair tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'absolute pointer-events-none z-10 bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl';
    tooltip.style.display = 'none';
    tooltip.style.fontFamily = 'monospace';
    containerRef.current?.appendChild(tooltip);
    tooltipRef.current = tooltip;

    chart.subscribeCrosshairMove((param) => {
      // Show tooltip
      if (!tooltip || !param.point || !param.time || !seriesRef.current) {
        tooltip.style.display = 'none';
        return;
      }

      const data = param.seriesData.get(seriesRef.current);
      if (!data || !('open' in data)) {
        tooltip.style.display = 'none';
        return;
      }

      const candle = data as CandlestickData<Time>;
      const timeValue = param.time as number;
      const originalCandle = originalCandlesRef.current.find(c => c.time === timeValue);
      const volume = originalCandle?.volume || 0;
      
      // Find previous candle for price change calculation
      const currentIndex = originalCandlesRef.current.findIndex(c => c.time === timeValue);
      const prevCandle = currentIndex > 0 ? originalCandlesRef.current[currentIndex - 1] : null;
      const priceChange = prevCandle ? ((candle.close - prevCandle.close) / prevCandle.close) * 100 : 0;
      const priceChangeColor = priceChange >= 0 ? '#22c55e' : '#ef4444';
      
      const date = new Date(timeValue * 1000);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      const formatPrice = (price: number) => {
        if (yAxisMode === "marketCap") {
          return formatMarketCap(price);
        }
        return price < 0.01 ? price.toFixed(6) : price.toFixed(4);
      };

      tooltip.innerHTML = `
        <div class="text-gray-300 mb-1">${dateStr} ${timeStr}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <div class="text-gray-400">O:</div><div class="text-gray-200">${formatPrice(candle.open)}</div>
          <div class="text-gray-400">H:</div><div class="text-gray-200">${formatPrice(candle.high)}</div>
          <div class="text-gray-400">L:</div><div class="text-gray-200">${formatPrice(candle.low)}</div>
          <div class="text-gray-400">C:</div><div class="text-gray-200">${formatPrice(candle.close)}</div>
          <div class="text-gray-400">Vol:</div><div class="text-gray-200">${volume > 0 ? formatMarketCap(volume) : 'N/A'}</div>
          ${prevCandle ? `<div class="text-gray-400">Change:</div><div style="color: ${priceChangeColor}">${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%</div>` : ''}
        </div>
      `;

      const coordinate = param.point;
      tooltip.style.left = coordinate.x + 10 + 'px';
      tooltip.style.top = coordinate.y - 10 + 'px';
      tooltip.style.display = 'block';
    });

    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      maSeriesRef.current = null;
      emaSeriesRef.current = null;
      vwapSeriesRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [containerHeight, theme, showVolume, yAxisMode]);

  // Calculate SMA (Simple Moving Average) with validation
  const calculateMovingAverage = useCallback((data: CandlestickData<Time>[], period: number): LineData<Time>[] => {
    if (!data || data.length < period || period < 1) return [];
    
    // Validate data and filter invalid values
    const validData = data.filter(d => 
      d.close !== null && 
      d.close !== undefined && 
      isFinite(d.close) && 
      d.close > 0
    );
    
    if (validData.length < period) return [];
    
    const ma: LineData<Time>[] = [];
    for (let i = period - 1; i < validData.length; i++) {
      let sum = 0;
      let validCount = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        if (validData[j] && validData[j].close > 0 && isFinite(validData[j].close)) {
          sum += validData[j].close;
          validCount++;
        }
      }
      
      if (validCount === period) {
        ma.push({
          time: validData[i].time,
          value: sum / period,
        });
      }
    }
    return ma;
  }, []);

  // Calculate EMA (Exponential Moving Average) with validation
  // EMA gives more weight to recent prices compared to SMA
  const calculateEMA = useCallback((data: CandlestickData<Time>[], period: number): LineData<Time>[] => {
    if (!data || data.length < period || period < 1) return [];
    
    // Validate data and filter invalid values
    const validData = data.filter(d => 
      d.close !== null && 
      d.close !== undefined && 
      isFinite(d.close) && 
      d.close > 0
    );
    
    if (validData.length < period) return [];
    
    const ema: LineData<Time>[] = [];
    // EMA smoothing factor: gives more weight to recent prices
    const multiplier = 2 / (period + 1);
    
    // Initialize EMA with SMA of first 'period' values (standard EMA initialization)
    let sum = 0;
    let validInitCount = 0;
    for (let i = 0; i < period && i < validData.length; i++) {
      if (validData[i] && validData[i].close > 0 && isFinite(validData[i].close)) {
        sum += validData[i].close;
        validInitCount++;
      }
    }
    
    // Must have exactly period values for proper initialization
    if (validInitCount < period) return [];
    
    // First EMA value = SMA of first period values (this is the standard way to initialize EMA)
    let currentEMA = sum / period;
    ema.push({ time: validData[period - 1].time, value: currentEMA });
    
    // Calculate EMA for remaining values using exponential smoothing
    // Formula: EMA = (Close - PreviousEMA) * multiplier + PreviousEMA
    // This gives more weight to recent prices than SMA
    for (let i = period; i < validData.length; i++) {
      if (validData[i] && validData[i].close > 0 && isFinite(validData[i].close)) {
        // EMA reacts more to recent price changes than SMA
        currentEMA = (validData[i].close - currentEMA) * multiplier + currentEMA;
        ema.push({ time: validData[i].time, value: currentEMA });
      }
    }
    return ema;
  }, []);

  // Calculate VWAP (Volume Weighted Average Price) with timeframe-aware resets
  const calculateVWAP = useCallback((candles: Candle[], formattedData: CandlestickData<Time>[], timeframe: string): LineData<Time>[] => {
    if (candles.length === 0 || formattedData.length === 0) return [];
    const vwap: LineData<Time>[] = [];
    
    // Helper to get the period key for reset logic (e.g., same day, same hour)
    const getPeriodKey = (timestamp: number, tf: string): string => {
      const date = new Date(timestamp * 1000);
      switch (tf) {
        case '1m':
        case '5m':
          // Reset hourly for minute timeframes
          return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
        case '1h':
        case '4h':
          // Reset daily for hourly timeframes
          return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
        case '1d':
          // Reset daily for daily timeframe
          return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
        default:
          return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
      }
    };
    
    let currentPeriodKey = '';
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < formattedData.length; i++) {
      const candle = candles[i];
      const volume = candle?.volume || 0;
      const time = formattedData[i].time as number;
      const typicalPrice = (formattedData[i].high + formattedData[i].low + formattedData[i].close) / 3;
      const periodKey = getPeriodKey(time, timeframe);
      
      // Check if we need to reset (new period)
      if (currentPeriodKey === '' || periodKey !== currentPeriodKey) {
        currentPeriodKey = periodKey;
        cumulativeTPV = typicalPrice * volume;
        cumulativeVolume = volume;
      } else {
        cumulativeTPV += typicalPrice * volume;
        cumulativeVolume += volume;
      }
      
      if (cumulativeVolume > 0) {
        vwap.push({
          time: formattedData[i].time,
          value: cumulativeTPV / cumulativeVolume,
        });
      }
    }
    return vwap;
  }, []);

  // Calculate RSI (Relative Strength Index) - Standard Wilder's RSI formula
  const calculateRSI = useCallback((data: CandlestickData<Time>[], period: number = 14): LineData<Time>[] => {
    // RSI needs at least period + 1 data points to calculate 'period' price changes
    if (!data || data.length < period + 1) return [];
    
    // Validate and keep sequential data points (don't filter - need continuity for price changes)
    const validData: CandlestickData<Time>[] = [];
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (d.close !== null && d.close !== undefined && isFinite(d.close) && d.close > 0) {
        validData.push(d);
      } else {
        // If we hit invalid data, we need to recalculate from this point
        // For simplicity, break and use what we have
        if (validData.length >= period + 1) break;
        return []; // Not enough valid sequential data
      }
    }
    
    if (validData.length < period + 1) return [];
    
    const rsi: LineData<Time>[] = [];
    
    // Step 1: Calculate initial average gain and loss
    // Need 'period' consecutive price changes, so we need period+1 price points
    let sumGains = 0;
    let sumLosses = 0;
    
    // Calculate changes from index 0 to period (gives us 'period' changes)
    for (let i = 0; i < period; i++) {
      const change = validData[i + 1].close - validData[i].close;
      if (change > 0) {
        sumGains += change;
      } else if (change < 0) {
        sumLosses += Math.abs(change);
      }
      // change === 0 contributes nothing (no gain, no loss)
    }
    
    let avgGain = sumGains / period;
    let avgLoss = sumLosses / period;
    
    // Handle edge case: no price movement
    if (avgLoss === 0 && avgGain === 0) {
      return [];
    }
    
    // Calculate first RSI value (at index 'period')
    if (avgLoss === 0) {
      // All gains, no losses = RSI = 100
      rsi.push({ time: validData[period].time, value: 100 });
    } else {
      const rs = avgGain / avgLoss;
      const rsiValue = 100 - (100 / (1 + rs));
      rsi.push({ 
        time: validData[period].time, 
        value: Math.max(0, Math.min(100, rsiValue)) 
      });
    }
    
    // Step 2: Calculate subsequent RSI values using Wilder's smoothing
    // Wilder's smoothing: newAvg = (oldAvg * (period - 1) + newValue) / period
    for (let i = period; i < validData.length - 1; i++) {
      const change = validData[i + 1].close - validData[i].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      
      // Apply Wilder's smoothing
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      // Calculate RSI
      if (avgLoss === 0) {
        if (avgGain > 0) {
          rsi.push({ time: validData[i + 1].time, value: 100 });
        } else {
          // No movement, skip or use previous value
          continue;
        }
      } else {
        const rs = avgGain / avgLoss;
        const rsiValue = 100 - (100 / (1 + rs));
        rsi.push({ 
          time: validData[i + 1].time, 
          value: Math.max(0, Math.min(100, rsiValue)) 
        });
      }
    }
    
    return rsi;
  }, []);

  // Memoize processed candles to avoid unnecessary recalculations
  const processedCandles = useMemo(() => {
    if (!candles || candles.length === 0) return { sorted: [], unique: [] };
    
    // Sort by time and remove duplicates (keep the last one if duplicates exist)
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);
    const uniqueCandles = sortedCandles.reduce((acc, candle) => {
      const existingIndex = acc.findIndex(c => c.time === candle.time);
      if (existingIndex >= 0) {
        // Replace with newer data if duplicate
        acc[existingIndex] = candle;
      } else {
        acc.push(candle);
      }
      return acc;
    }, [] as typeof candles);
    
    return { sorted: sortedCandles, unique: uniqueCandles };
  }, [candles]);

  // Update data when candles change
  useEffect(() => {
    if (!seriesRef.current || !processedCandles.unique || processedCandles.unique.length === 0) return;

    const uniqueCandles = processedCandles.unique;
    
    // Reset zoom flag when candles change significantly (e.g., timeframe change)
    // Check if the first candle time has changed significantly (more than 1 hour difference)
    if (originalCandlesRef.current.length > 0 && uniqueCandles.length > 0) {
      const oldFirstTime = originalCandlesRef.current[0]?.time;
      const newFirstTime = uniqueCandles[0]?.time;
      if (oldFirstTime && newFirstTime && Math.abs(newFirstTime - oldFirstTime) > 3600) {
        // Significant time difference, likely timeframe change - reset zoom
        initialZoomSetRef.current = false;
      }
    }

    // Transform data based on Y-axis mode
    let formattedData: CandlestickData<Time>[];
    
    if (yAxisMode === "marketCap" && currentMarketCap && currentPrice && currentPrice > 0 && isFinite(currentPrice) && isFinite(currentMarketCap)) {
      // Calculate market cap values from price data
      // historical_mcap = (historical_price / current_price) * current_mcap
      formattedData = uniqueCandles.map(c => {
        const openMcap = c.open > 0 && isFinite(c.open) ? (c.open / currentPrice) * currentMarketCap : 0;
        const highMcap = c.high > 0 && isFinite(c.high) ? (c.high / currentPrice) * currentMarketCap : 0;
        const lowMcap = c.low > 0 && isFinite(c.low) ? (c.low / currentPrice) * currentMarketCap : 0;
        const closeMcap = c.close > 0 && isFinite(c.close) ? (c.close / currentPrice) * currentMarketCap : 0;
        return {
          time: c.time as Time,
          open: Math.max(0, openMcap),
          high: Math.max(0, highMcap),
          low: Math.max(0, lowMcap),
          close: Math.max(0, closeMcap),
        };
      });
    } else {
      // Use price data as-is
      formattedData = uniqueCandles.map(c => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    }

    seriesRef.current.setData(formattedData);
    originalCandlesRef.current = uniqueCandles; // Store for tooltip
    
    // Update volume data if available
    if (showVolume && volumeSeriesRef.current && uniqueCandles.length > 0) {
      const volumeData: HistogramData<Time>[] = formattedData.map((candle, idx) => {
        const originalCandle = uniqueCandles[idx];
        const volume = originalCandle?.volume || 0;
        // Color volume bars based on price direction
        const isUp = candle.close >= candle.open;
        return {
          time: candle.time,
          value: volume,
          color: isUp ? (theme === "dark" ? "#22c55e80" : "#22c55e40") : (theme === "dark" ? "#ef444480" : "#ef444440"),
        };
      });
      volumeSeriesRef.current.setData(volumeData);
      
      // Configure volume price scale after data is set
      if (chartRef.current) {
        try {
          const volumePriceScale = chartRef.current.priceScale('volume');
          if (volumePriceScale) {
            volumePriceScale.applyOptions({
              scaleMargins: {
                top: 0.7, // Increased top margin to make bars shorter
                bottom: 0, // Anchor to x-axis
              },
              visible: false, // Hide volume scale labels
              autoScale: true, // Enable auto-scaling for proper bar height
              entireTextOnly: false,
            });
          }
        } catch (e) {
          // Price scale might not be available, skip configuration
        }
      }
    }
    
    // Update moving average if enabled
    if (showMovingAverage && maSeriesRef.current && formattedData.length >= movingAveragePeriod) {
      const maData = calculateMovingAverage(formattedData, movingAveragePeriod);
      if (maData.length > 0) {
        maSeriesRef.current.setData(maData);
      }
      // Update color if changed
      maSeriesRef.current.applyOptions({ color: colors.sma });
    } else if (showMovingAverage && !maSeriesRef.current && chartRef.current && formattedData.length >= movingAveragePeriod) {
      // Create MA series if it doesn't exist
      const maSeries = chartRef.current.addSeries(LineSeries, {
        color: colors.sma,
        lineWidth: 1,
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: 8,
          minMove: 0.00000001,
        },
      });
      maSeriesRef.current = maSeries;
      const maData = calculateMovingAverage(formattedData, movingAveragePeriod);
      if (maData.length > 0) {
        maSeries.setData(maData);
      }
    } else if (!showMovingAverage && maSeriesRef.current && chartRef.current) {
      // Remove MA series if disabled
      chartRef.current.removeSeries(maSeriesRef.current);
      maSeriesRef.current = null;
    }
    
    // Update EMA if enabled
    if (showEMA && emaSeriesRef.current && formattedData.length >= movingAveragePeriod) {
      const emaData = calculateEMA(formattedData, movingAveragePeriod);
      if (emaData.length > 0) {
        emaSeriesRef.current.setData(emaData);
      }
      // Update color if changed
      emaSeriesRef.current.applyOptions({ color: colors.ema });
    } else if (showEMA && !emaSeriesRef.current && chartRef.current && formattedData.length >= movingAveragePeriod) {
      const emaSeries = chartRef.current.addSeries(LineSeries, {
        color: colors.ema,
        lineWidth: 1,
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: 8,
          minMove: 0.00000001,
        },
      });
      emaSeriesRef.current = emaSeries;
      const emaData = calculateEMA(formattedData, movingAveragePeriod);
      if (emaData.length > 0) {
        emaSeries.setData(emaData);
      }
    } else if (!showEMA && emaSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(emaSeriesRef.current);
      emaSeriesRef.current = null;
    }
    
    // Update VWAP if enabled
    if (showVWAP && vwapSeriesRef.current && formattedData.length > 0 && uniqueCandles.length > 0) {
      const vwapData = calculateVWAP(uniqueCandles, formattedData, timeframe);
      if (vwapData.length > 0) {
        vwapSeriesRef.current.setData(vwapData);
      }
      // Update color if changed
      vwapSeriesRef.current.applyOptions({ color: colors.vwap });
    } else if (showVWAP && !vwapSeriesRef.current && chartRef.current && formattedData.length > 0 && uniqueCandles.length > 0) {
      const vwapSeries = chartRef.current.addSeries(LineSeries, {
        color: colors.vwap,
        lineWidth: 1,
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: 8,
          minMove: 0.00000001,
        },
      });
      vwapSeriesRef.current = vwapSeries;
      const vwapData = calculateVWAP(uniqueCandles, formattedData, timeframe);
      if (vwapData.length > 0) {
        vwapSeries.setData(vwapData);
      }
    } else if (!showVWAP && vwapSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(vwapSeriesRef.current);
      vwapSeriesRef.current = null;
    }
    
    // Update RSI if enabled (RSI uses separate price scale)
    if (showRSI && rsiSeriesRef.current && formattedData.length >= 15) {
      const rsiData = calculateRSI(formattedData, 14);
      if (rsiData.length > 0) {
        rsiSeriesRef.current.setData(rsiData);
      }
      // Update color if changed
      rsiSeriesRef.current.applyOptions({ color: colors.rsi });
    } else if (showRSI && !rsiSeriesRef.current && chartRef.current && formattedData.length >= 15) {
      // Create RSI series first (this creates the price scale)
      const rsiSeries = chartRef.current.addSeries(LineSeries, {
        color: colors.rsi,
        lineWidth: 1,
        priceScaleId: 'rsi',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      });
      rsiSeriesRef.current = rsiSeries;
      
      // Configure RSI price scale after series is created
      try {
        const rsiPriceScale = chartRef.current.priceScale('rsi');
        if (rsiPriceScale) {
          rsiPriceScale.applyOptions({
            scaleMargins: {
              top: 0.7,
              bottom: showVolume ? 0.4 : 0.1,
            },
            visible: true,
            autoScale: false,
            entireTextOnly: false,
          });
        }
      } catch (e) {
        // Price scale configuration will be handled later
      }
      
      const rsiData = calculateRSI(formattedData, 14);
      if (rsiData.length > 0) {
        rsiSeries.setData(rsiData);
        
        // Configure RSI price scale after data is set
        try {
          const rsiPriceScale = chartRef.current.priceScale('rsi');
          if (rsiPriceScale) {
            rsiPriceScale.applyOptions({
              scaleMargins: {
                top: 0.7,
                bottom: showVolume ? 0.4 : 0.1,
              },
              visible: true,
              autoScale: false,
              entireTextOnly: false,
            });
          }
        } catch (e) {
          // Price scale might not be available, skip configuration
        }
      }
    } else if (!showRSI && rsiSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiSeriesRef.current);
      rsiSeriesRef.current = null;
    }
    
    if (chartRef.current && formattedData.length > 0) {
      // Find min and max values
      const values = formattedData.flatMap(c => [c.high, c.low, c.open, c.close]).filter(p => p > 0 && isFinite(p));
      if (values.length > 0) {
        const minValue = Math.min(...values);
        
        // Determine appropriate precision based on value magnitude
        let precision = 2;
        if (yAxisMode === "marketCap") {
          // Market cap is typically in millions/billions, so use 2 decimals
          precision = 2;
        } else {
          // Price precision logic
          if (minValue < 0.0001) {
            precision = 8; // For very small values like 0.00004964
          } else if (minValue < 0.01) {
            precision = 6; // For small values like 0.001
          } else if (minValue < 1) {
            precision = 4; // For values like 0.1
          } else if (minValue < 100) {
            precision = 2; // For normal values
          } else {
            precision = 0; // For large values
          }
        }
        
        // Calculate minMove based on precision
        const minMove = precision >= 8 ? 0.00000001 : precision >= 6 ? 0.000001 : precision >= 4 ? 0.0001 : precision >= 2 ? 0.01 : 1;
        
        // Update series price format
        if (seriesRef.current) {
          seriesRef.current.applyOptions({
            priceFormat: {
              type: 'price',
              precision: precision,
              minMove: minMove,
            },
          });
        }
        
        // Get price scale and apply formatting
        const priceScale = chartRef.current.priceScale('right');
        if (priceScale) {
          priceScale.applyOptions({
            entireTextOnly: false,
            minimumWidth: 80,
            ticksVisible: true,
          });
        }
        
        // Update localization price formatter
        if (chartRef.current) {
          chartRef.current.applyOptions({
            localization: {
              priceFormatter: (price: number) => {
                if (yAxisMode === "marketCap") {
                  return formatMarketCap(price);
                } else {
                  // For price mode, add commas to large numbers
                  return formatPriceWithCommas(price, precision);
                }
              },
            },
          });
        }
      }
      
      // Set initial zoom only on first load, not when new data arrives
      if (!initialZoomSetRef.current && formattedData.length > 0) {
        const timeScale = chartRef.current.timeScale();
        const totalBars = formattedData.length;
        const visibleBars = Math.max(10, Math.floor(totalBars * 0.3)); // Show last 30% or minimum 10 bars
        const from = totalBars - visibleBars;
        const to = totalBars - 1;
        timeScale.setVisibleLogicalRange({ from, to });
        initialZoomSetRef.current = true;
      }
    }
  }, [processedCandles, yAxisMode, currentMarketCap, currentPrice, showVolume, showMovingAverage, movingAveragePeriod, showVWAP, showRSI, showEMA, timeframe, colors, theme, calculateMovingAverage, calculateEMA, calculateVWAP, calculateRSI]);

  const borderColor = theme === "dark" ? "#374151" : "#d1d5db";
  
  return (
    <div
      className="w-full relative overflow-visible"
      style={{ 
        height,
        borderRight: `1px solid ${borderColor}`,
        paddingRight: priceScalePadding,
        marginRight: priceScalePadding ? -priceScalePadding : 0,
        boxSizing: "content-box",
      }}
    >
      <div
        ref={containerRef}
        className="w-full h-full"
        style={height === undefined ? { height: '100%' } : { height }}
      />
    </div>
  );
});

export default LightweightChart;



