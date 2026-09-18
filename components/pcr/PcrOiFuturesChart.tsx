"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

interface Row {
  timestamp: string;
  futuresLTP: number;
  totalCallOI: number;
  totalPutOI: number;
}

interface PcrOiFuturesChartProps {
  data: Row[];
}

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  timestamp: string;
  futuresLTP?: number;
  totalCallOI?: number;
  totalPutOI?: number;
}

const INDIA_TIME_ZONE = "Asia/Kolkata";

const INDIA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function toChartTime(timestamp: string): UTCTimestamp {
  return Math.floor(new Date(timestamp).getTime() / 1000) as UTCTimestamp;
}

function formatIndiaTime(timestamp: string | Date) {
  return `${INDIA_DATE_TIME_FORMATTER.format(new Date(timestamp))} IST`;
}

// 1-minute aggregation (last snapshot in each minute), same approach as PcrHistoryChart.
function aggregateToOneMinute(rows: Row[]): Row[] {
  if (!rows.length) return [];

  const buckets = new Map<number, Row>();

  for (const row of rows) {
    const timestampMs = new Date(row.timestamp).getTime();

    if (!Number.isFinite(timestampMs)) continue;

    const minuteTimestampMs = Math.floor(timestampMs / 60_000) * 60_000;

    buckets.set(minuteTimestampMs, row);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([minuteTimestampMs, row]) => ({
      ...row,
      timestamp: new Date(minuteTimestampMs).toISOString(),
    }));
}

export default function PcrOiFuturesChart({ data }: PcrOiFuturesChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const callOiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const putOiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const futuresSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const dataRef = useRef<Row[]>(data);

  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    timestamp: "",
  });

  const [timeframe, setTimeframe] = useState<"default" | "1m">("default");

  /*
   * ---------------------------------------------------------
   * CREATE CHART
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const chart = createChart(container, {
      autoSize: true,

      layout: {
        attributionLogo: false,
        background: {
          color: "transparent",
        },
        textColor: "#94a3b8",
        fontFamily: "monospace",
        fontSize: 11,
      },

      grid: {
        vertLines: {
          color: "rgba(51, 65, 85, 0.35)",
        },
        horzLines: {
          color: "rgba(51, 65, 85, 0.35)",
        },
      },

      crosshair: {
        mode: CrosshairMode.Magnet,

        vertLine: {
          color: "#64748b",
          width: 1,
          style: 2,
          labelBackgroundColor: "#0f172a",
        },

        horzLine: {
          color: "#64748b",
          width: 1,
          style: 2,
          labelBackgroundColor: "#0f172a",
        },
      },

      rightPriceScale: {
        visible: true,
        borderColor: "#334155",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },

      leftPriceScale: {
        visible: true,
        borderColor: "#334155",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },

      timeScale: {
        borderColor: "#334155",

        timeVisible: true,
        secondsVisible: true,

        tickMarkFormatter: (time: any) => {
          const date =
            typeof time === "number" ? new Date(time * 1000) : new Date(time);

          return new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(date);
        },

        rightOffset: 5,

        barSpacing: 8,

        minBarSpacing: 2,

        lockVisibleTimeRangeOnResize: true,
      },

      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },

      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },

      localization: {
        timeFormatter: (time: any) => {
          const date =
            typeof time === "number" ? new Date(time * 1000) : new Date(time);

          return `${INDIA_DATE_TIME_FORMATTER.format(date)} IST`;
        },
      },
    });

    chartRef.current = chart;

    /*
     * CALL OI — LEFT SCALE
     */
    const callOiSeries = chart.addSeries(LineSeries, {
      color: "#ef4444",

      lineWidth: 2,

      priceScaleId: "left",

      priceFormat: {
        type: "price",
        precision: 0,
        minMove: 1,
      },

      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,

      lastValueVisible: true,
      priceLineVisible: false,

      title: "Call OI",
    });

    /*
     * PUT OI — LEFT SCALE (shares axis with Call OI, same units)
     */
    const putOiSeries = chart.addSeries(LineSeries, {
      color: "#22c55e",

      lineWidth: 2,

      priceScaleId: "left",

      priceFormat: {
        type: "price",
        precision: 0,
        minMove: 1,
      },

      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,

      lastValueVisible: true,
      priceLineVisible: false,

      title: "Put OI",
    });

    /*
     * FUTURES — RIGHT SCALE
     */
    const futuresSeries = chart.addSeries(LineSeries, {
      color: "#818cf8",

      lineWidth: 2,

      lineStyle: 2,

      priceScaleId: "right",

      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },

      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,

      lastValueVisible: true,
      priceLineVisible: false,

      title: "Futures",
    });

    callOiSeriesRef.current = callOiSeries;
    putOiSeriesRef.current = putOiSeries;
    futuresSeriesRef.current = futuresSeries;

    /*
     * ---------------------------------------------------------
     * CROSSHAIR / TOOLTIP
     * ---------------------------------------------------------
     */
    const handleCrosshairMove = (param: any) => {
      if (
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0 ||
        !containerRef.current
      ) {
        setTooltip((previous) => ({ ...previous, visible: false }));
        return;
      }

      const timestamp = param.time;

      if (timestamp === undefined) {
        setTooltip((previous) => ({ ...previous, visible: false }));
        return;
      }

      const row = findNearestRow(dataRef.current, Number(timestamp));

      if (!row) {
        setTooltip((previous) => ({ ...previous, visible: false }));
        return;
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const tooltipWidth = 220;
      const tooltipHeight = 130;

      let x = param.point.x + 15;
      let y = param.point.y + 15;

      if (x + tooltipWidth > containerWidth) {
        x = param.point.x - tooltipWidth - 15;
      }

      if (y + tooltipHeight > containerHeight) {
        y = param.point.y - tooltipHeight - 15;
      }

      x = Math.max(5, x);
      y = Math.max(5, y);

      setTooltip({
        visible: true,
        x,
        y,
        timestamp: row.timestamp,
        futuresLTP: row.futuresLTP,
        totalCallOI: row.totalCallOI,
        totalPutOI: row.totalPutOI,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const handleMouseLeave = () => {
      setTooltip((previous) => ({ ...previous, visible: false }));
    };

    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mouseleave", handleMouseLeave);

      chart.unsubscribeCrosshairMove(handleCrosshairMove);

      chart.remove();

      chartRef.current = null;
      callOiSeriesRef.current = null;
      putOiSeriesRef.current = null;
      futuresSeriesRef.current = null;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * UPDATE DATA
   * ---------------------------------------------------------
   */
  useEffect(() => {
    dataRef.current = data;

    const callOiSeries = callOiSeriesRef.current;
    const putOiSeries = putOiSeriesRef.current;
    const futuresSeries = futuresSeriesRef.current;
    const chart = chartRef.current;

    if (!callOiSeries || !putOiSeries || !futuresSeries || !chart) return;

    const timeScale = chart.timeScale();

    if (!data || data.length === 0) {
      callOiSeries.setData([]);
      putOiSeries.setData([]);
      futuresSeries.setData([]);
      return;
    }

    /*
     * Sort oldest -> newest, drop bad rows.
     */
    const sortedData = [...data]
      .filter(
        (row) =>
          Number.isFinite(Number(row.futuresLTP)) &&
          Number.isFinite(Number(row.totalCallOI)) &&
          Number.isFinite(Number(row.totalPutOI)) &&
          !Number.isNaN(new Date(row.timestamp).getTime()),
      )
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    /*
     * Remove duplicate timestamps.
     */
    const uniqueData: Row[] = [];
    const seen = new Set<number>();

    for (const row of sortedData) {
      const time = Number(toChartTime(row.timestamp));

      if (seen.has(time)) continue;

      seen.add(time);
      uniqueData.push(row);
    }

    if (uniqueData.length === 0) {
      callOiSeries.setData([]);
      putOiSeries.setData([]);
      futuresSeries.setData([]);
      return;
    }

    const chartData =
      timeframe === "1m" ? aggregateToOneMinute(uniqueData) : uniqueData;

    dataRef.current = chartData;

    if (chartData.length === 0) {
      callOiSeries.setData([]);
      putOiSeries.setData([]);
      futuresSeries.setData([]);
      return;
    }

    /*
     * Save current view so live updates don't yank the user's zoom/pan.
     */
    const oldRange = timeScale.getVisibleLogicalRange();

    let followLatest = true;

    if (oldRange) {
      const oldDataCount = callOiSeries.data().length;
      followLatest = oldRange.to >= oldDataCount - 5;
    }

    const callOiData = chartData.map((row) => ({
      time: toChartTime(row.timestamp),
      value: Number(row.totalCallOI),
    }));

    const putOiData = chartData.map((row) => ({
      time: toChartTime(row.timestamp),
      value: Number(row.totalPutOI),
    }));

    const futuresData = chartData.map((row) => ({
      time: toChartTime(row.timestamp),
      value: Number(row.futuresLTP),
    }));

    callOiSeries.setData(callOiData);
    putOiSeries.setData(putOiData);
    futuresSeries.setData(futuresData);

    if (!oldRange) {
      timeScale.fitContent();
      return;
    }

    if (followLatest) {
      timeScale.scrollToRealTime();
      return;
    }

    const maxIndex = chartData.length - 1;

    const from = Math.max(0, Math.min(oldRange.from, maxIndex));
    const to = Math.max(from + 1, Math.min(oldRange.to, maxIndex));

    timeScale.setVisibleLogicalRange({ from, to });
  }, [data, timeframe]);

  /*
   * ---------------------------------------------------------
   * BUTTON CONTROLS
   * ---------------------------------------------------------
   */
  const zoomIn = () => {
    const chart = chartRef.current;
    if (!chart) return;

    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;

    const center = (range.from + range.to) / 2;
    const half = (range.to - range.from) / 2;
    const newHalf = Math.max(5, half * 0.7);

    chart.timeScale().setVisibleLogicalRange({
      from: center - newHalf,
      to: center + newHalf,
    });
  };

  const zoomOut = () => {
    const chart = chartRef.current;
    if (!chart) return;

    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;

    const center = (range.from + range.to) / 2;
    const half = (range.to - range.from) / 2;
    const newHalf = Math.min(Math.max(data.length, 20), half * 1.4);

    chart.timeScale().setVisibleLogicalRange({
      from: center - newHalf,
      to: center + newHalf,
    });
  };

  const resetZoom = () => {
    chartRef.current?.timeScale().fitContent();
  };

  function getDisplayData(): Row[] {
    if (timeframe === "1m") {
      return aggregateToOneMinute(data);
    }
    return data;
  }

  const showLast = (bars: number) => {
    const chart = chartRef.current;
    if (!chart) return;

    const total = getDisplayData().length;
    if (total === 0) return;

    const from = Math.max(0, total - bars);

    chart.timeScale().setVisibleLogicalRange({
      from,
      to: total + 2,
    });
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */
  return (
    <div className="w-full">
      {/* TOOLBAR */}
      <button
        type="button"
        onClick={() => setTimeframe("default")}
        className={`px-3 py-1.5 rounded-md border text-xs font-mono ${
          timeframe === "default"
            ? "bg-cyan-600 border-cyan-500 text-white"
            : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
        }`}
      >
        Raw
      </button>

      <button
        type="button"
        onClick={() => setTimeframe("1m")}
        className={`px-3 py-1.5 rounded-md border text-xs font-mono ${
          timeframe === "1m"
            ? "bg-cyan-600 border-cyan-500 text-white"
            : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
        }`}
      >
        1 Minute
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={zoomIn}
            className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-mono"
            title="Zoom in"
          >
            +
          </button>

          <button
            type="button"
            onClick={zoomOut}
            className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-mono"
            title="Zoom out"
          >
            −
          </button>

          <button
            type="button"
            onClick={resetZoom}
            className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-mono"
            title="Reset zoom"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={() => showLast(30)}
            className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-mono"
          >
            30
          </button>

          <button
            type="button"
            onClick={() => showLast(60)}
            className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-mono"
          >
            60
          </button>

          <button
            type="button"
            onClick={() => showLast(120)}
            className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-mono"
          >
            120
          </button>

          <button
            type="button"
            onClick={() => showLast(data.length)}
            className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-mono"
          >
            ALL
          </button>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Call OI
          </div>

          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Put OI
          </div>

          <div className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Futures
          </div>
        </div>
      </div>

      {/* CHART */}
      <div
        ref={containerRef}
        className="relative w-full h-[420px] min-h-[320px] overflow-hidden rounded-lg"
      >
        {/* CUSTOM TOOLTIP */}
        {tooltip.visible && (
          <div
            className="pointer-events-none absolute z-50 w-[220px] rounded-lg bg-transparent shadow-none backdrop-blur-none px-3 py-2.5 text-[11px] font-mono"
            style={{
              left: tooltip.x,
              top: tooltip.y,
            }}
          >
            <div className="text-slate-400 border-b border-slate-800 pb-1.5 mb-2">
              {formatIndiaTime(tooltip.timestamp)}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-indigo-400">Futures</span>

                <span className="text-white font-bold">
                  {tooltip.futuresLTP?.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-t border-slate-800 pt-1.5 mt-1.5">
                <span className="text-rose-400">Call OI</span>

                <span className="text-slate-200">
                  {tooltip.totalCallOI?.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-emerald-400">Put OI</span>

                <span className="text-slate-200">
                  {tooltip.totalPutOI?.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HELP TEXT */}
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-slate-600 font-mono">
        <span>Scroll = zoom · Drag = pan · Double-click = reset</span>

        <span>
          {timeframe === "1m"
            ? `${aggregateToOneMinute(data).length} 1-minute samples`
            : `${data.length} raw samples`}
        </span>
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * FIND NEAREST ROW
 * ---------------------------------------------------------
 */
function findNearestRow(rows: Row[], timestampSeconds: number): Row | null {
  if (!rows.length) return null;

  let nearest = rows[0];

  let smallestDifference = Math.abs(
    toChartTime(rows[0].timestamp) - timestampSeconds,
  );

  for (let i = 1; i < rows.length; i++) {
    const difference = Math.abs(
      toChartTime(rows[i].timestamp) - timestampSeconds,
    );

    if (difference < smallestDifference) {
      smallestDifference = difference;
      nearest = rows[i];
    }
  }

  return nearest;
}
