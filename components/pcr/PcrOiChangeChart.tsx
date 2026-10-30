"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  CrosshairMode,
  LineStyle,
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

// Row + change in OI vs the first tick of the day
interface ChartRow extends Row {
  callChange: number;
  putChange: number;
}

interface PcrOiChangeChartProps {
  data: Row[];
}

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  timestamp: string;
  futuresLTP?: number;
  callChange?: number;
  putChange?: number;
}

type Timeframe = "default" | "1m" | "3m";

const TIMEFRAME_MINUTES: Record<Exclude<Timeframe, "default">, number> = {
  "1m": 1,
  "3m": 3,
};

const INDIA_TIME_ZONE = "Asia/Kolkata";

const IST_DATE_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: INDIA_TIME_ZONE,
}); // YYYY-MM-DD in IST

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

// Axis label: 1,23,45,678 -> 1.23Cr / 4.5L
function compactOi(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(2)}L`;
  return `${value}`;
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-IN")}`;
}

// Generic N-minute aggregation (keeps the LAST snapshot in each bucket)
function aggregateToMinutes<T extends { timestamp: string }>(
  rows: T[],
  minutes: number,
): T[] {
  if (!rows.length) return [];

  const bucketMs = minutes * 60_000;
  const buckets = new Map<number, T>();

  for (const row of rows) {
    const ms = new Date(row.timestamp).getTime();
    if (!Number.isFinite(ms)) continue;
    buckets.set(Math.floor(ms / bucketMs) * bucketMs, row);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketStartMs, row]) => ({
      ...row,
      timestamp: new Date(bucketStartMs).toISOString(),
    }));
}

/*
 * Build today's change-in-OI rows:
 *  - only the current IST day (day of the latest row)
 *  - first tick of that day = baseline (change = 0)
 */
function buildChangeRows(data: Row[]): ChartRow[] {
  const valid = data.filter(
    (r) =>
      Number.isFinite(Number(r.futuresLTP)) &&
      Number.isFinite(Number(r.totalCallOI)) &&
      Number.isFinite(Number(r.totalPutOI)) &&
      !Number.isNaN(new Date(r.timestamp).getTime()),
  );

  if (valid.length === 0) return [];

  const latestMs = Math.max(
    ...valid.map((r) => new Date(r.timestamp).getTime()),
  );
  const todayKey = IST_DATE_KEY.format(new Date(latestMs));

  const sorted = valid
    .filter((r) => IST_DATE_KEY.format(new Date(r.timestamp)) === todayKey)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  // remove duplicate timestamps
  const unique: Row[] = [];
  const seen = new Set<number>();
  for (const row of sorted) {
    const t = Number(toChartTime(row.timestamp));
    if (seen.has(t)) continue;
    seen.add(t);
    unique.push(row);
  }

  if (unique.length === 0) return [];

  const callBase = Number(unique[0].totalCallOI);
  const putBase = Number(unique[0].totalPutOI);

  return unique.map((r) => ({
    ...r,
    callChange: Number(r.totalCallOI) - callBase,
    putChange: Number(r.totalPutOI) - putBase,
  }));
}

export default function PcrOiChangeChart({ data }: PcrOiChangeChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const callSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const putSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const futuresSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const dataRef = useRef<ChartRow[]>([]);

  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    timestamp: "",
  });

  const [timeframe, setTimeframe] = useState<Timeframe>("default");
  const [sampleCount, setSampleCount] = useState(0);

  /* ------------------------- CREATE CHART ------------------------- */
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const chart = createChart(container, {
      autoSize: true,

      layout: {
        attributionLogo: false,
        background: { color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "monospace",
        fontSize: 11,
      },

      grid: {
        vertLines: { color: "rgba(51, 65, 85, 0.35)" },
        horzLines: { color: "rgba(51, 65, 85, 0.35)" },
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
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },

      leftPriceScale: {
        visible: true,
        borderColor: "#334155",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },

      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: (time: any) => {
          const date =
            typeof time === "number" ? new Date(time * 1000) : new Date(time);

          return new Intl.DateTimeFormat("en-IN", {
            timeZone: INDIA_TIME_ZONE,
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

    const oiPriceFormat = {
      type: "custom" as const,
      formatter: (price: number) => compactOi(price),
      minMove: 1,
    };

    /* CALL OI CHANGE — LEFT SCALE */
    const callSeries = chart.addSeries(LineSeries, {
      color: "rgba(239, 68, 68, 0.75)",
      lineWidth: 2,
      priceScaleId: "left",
      priceFormat: oiPriceFormat,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lastValueVisible: true,
      priceLineVisible: false,
      title: "Call Δ",
    });

    /* PUT OI CHANGE — LEFT SCALE (same units, same axis) */
    const putSeries = chart.addSeries(LineSeries, {
      color: "rgba(34, 197, 94, 0.75)",
      lineWidth: 2,
      priceScaleId: "left",
      priceFormat: oiPriceFormat,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lastValueVisible: true,
      priceLineVisible: false,
      title: "Put Δ",
    });

    /* FUTURES — RIGHT SCALE */
    const futuresSeries = chart.addSeries(LineSeries, {
      color: "rgba(129, 140, 248, 0.5)",
      lineWidth: 2,
      lineStyle: 2,
      priceScaleId: "right",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    // Zero line = opening OI of the day
    callSeries.createPriceLine({
      price: 0,
      color: "#94a3b8",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "Open",
    });

    callSeriesRef.current = callSeries;
    putSeriesRef.current = putSeries;
    futuresSeriesRef.current = futuresSeries;

    /* ------------------- CROSSHAIR / TOOLTIP ------------------- */
    const handleCrosshairMove = (param: any) => {
      if (
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0 ||
        !containerRef.current ||
        param.time === undefined
      ) {
        setTooltip((previous) => ({ ...previous, visible: false }));
        return;
      }

      const row = findNearestRow(dataRef.current, Number(param.time));

      if (!row) {
        setTooltip((previous) => ({ ...previous, visible: false }));
        return;
      }

      const tooltipWidth = 250;
      const tooltipHeight = 150;

      let x = param.point.x + 15;
      let y = param.point.y + 15;

      if (x + tooltipWidth > container.clientWidth) {
        x = param.point.x - tooltipWidth - 15;
      }
      if (y + tooltipHeight > container.clientHeight) {
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
        callChange: row.callChange,
        putChange: row.putChange,
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
      callSeriesRef.current = null;
      putSeriesRef.current = null;
      futuresSeriesRef.current = null;
    };
  }, []);

  /* --------------------------- UPDATE DATA --------------------------- */
  useEffect(() => {
    const callSeries = callSeriesRef.current;
    const putSeries = putSeriesRef.current;
    const futuresSeries = futuresSeriesRef.current;
    const chart = chartRef.current;

    if (!callSeries || !putSeries || !futuresSeries || !chart) return;

    const timeScale = chart.timeScale();

    // today's rows with change vs first tick (baseline taken from RAW data)
    const changeRows = buildChangeRows(data);

    const chartData =
      timeframe === "default"
        ? changeRows
        : aggregateToMinutes(changeRows, TIMEFRAME_MINUTES[timeframe]);

    dataRef.current = chartData;
    setSampleCount(chartData.length);

    if (chartData.length === 0) {
      callSeries.setData([]);
      putSeries.setData([]);
      futuresSeries.setData([]);
      return;
    }

    // keep user's zoom/pan unless they are at the live edge
    const oldRange = timeScale.getVisibleLogicalRange();
    let followLatest = true;

    if (oldRange) {
      const oldDataCount = callSeries.data().length;
      followLatest = oldRange.to >= oldDataCount - 5;
    }

    callSeries.setData(
      chartData.map((r) => ({
        time: toChartTime(r.timestamp),
        value: r.callChange,
      })),
    );
    putSeries.setData(
      chartData.map((r) => ({
        time: toChartTime(r.timestamp),
        value: r.putChange,
      })),
    );
    futuresSeries.setData(
      chartData.map((r) => ({
        time: toChartTime(r.timestamp),
        value: Number(r.futuresLTP),
      })),
    );

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

  /* -------------------------- BUTTON CONTROLS -------------------------- */
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
    const newHalf = Math.min(Math.max(dataRef.current.length, 20), half * 1.4);

    chart.timeScale().setVisibleLogicalRange({
      from: center - newHalf,
      to: center + newHalf,
    });
  };

  const resetZoom = () => {
    chartRef.current?.timeScale().fitContent();
  };

  const showLast = (bars: number) => {
    const chart = chartRef.current;
    if (!chart) return;

    const total = dataRef.current.length;
    if (total === 0) return;

    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, total - bars),
      to: total + 2,
    });
  };

  const tfButton = (tf: Timeframe, label: string) => (
    <button
      key={tf}
      type="button"
      onClick={() => setTimeframe(tf)}
      className={`px-3 py-1.5 rounded-md border text-xs font-mono ${
        timeframe === tf
          ? "bg-cyan-600 border-cyan-500 text-white"
          : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );

  const ctrlBtn =
    "px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-mono";

  const diff =
    tooltip.callChange !== undefined && tooltip.putChange !== undefined
      ? tooltip.putChange - tooltip.callChange
      : undefined;

  /* ------------------------------ RENDER ------------------------------ */
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {tfButton("default", "Raw")}
        {tfButton("1m", "1 Minute")}
        {tfButton("3m", "3 Minute")}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={zoomIn}
            className={`${ctrlBtn} text-slate-200`}
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className={`${ctrlBtn} text-slate-200`}
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className={`${ctrlBtn} text-slate-200`}
            title="Reset zoom"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => showLast(30)}
            className={`${ctrlBtn} text-slate-300`}
          >
            30
          </button>
          <button
            type="button"
            onClick={() => showLast(60)}
            className={`${ctrlBtn} text-slate-300`}
          >
            60
          </button>
          <button
            type="button"
            onClick={() => showLast(120)}
            className={`${ctrlBtn} text-slate-300`}
          >
            120
          </button>
          <button
            type="button"
            onClick={() => showLast(sampleCount)}
            className={`${ctrlBtn} text-slate-300`}
          >
            ALL
          </button>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500/75" />
            Call OI Change
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500/75" />
            Put OI Change
          </div>
          <div className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-indigo-400/50" />
            Futures
          </div>
        </div>
      </div>

      {/* CHART */}
      <div
        ref={containerRef}
        className="relative w-full h-[420px] min-h-[320px] overflow-hidden rounded-lg"
      >
        {tooltip.visible && (
          <div
            className="pointer-events-none absolute z-50 w-[250px] rounded-lg bg-transparent px-3 py-2.5 text-[11px] font-mono"
            style={{ left: tooltip.x, top: tooltip.y }}
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
                <span className="text-rose-400">Call OI Chg</span>
                <span
                  className={`font-bold ${
                    (tooltip.callChange ?? 0) >= 0
                      ? "text-slate-100"
                      : "text-rose-300"
                  }`}
                >
                  {tooltip.callChange !== undefined
                    ? signed(tooltip.callChange)
                    : ""}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-emerald-400">Put OI Chg</span>
                <span
                  className={`font-bold ${
                    (tooltip.putChange ?? 0) >= 0
                      ? "text-slate-100"
                      : "text-rose-300"
                  }`}
                >
                  {tooltip.putChange !== undefined
                    ? signed(tooltip.putChange)
                    : ""}
                </span>
              </div>

              {diff !== undefined && (
                <div className="flex justify-between gap-4 border-t border-slate-800 pt-1.5 mt-1.5">
                  <span className="text-slate-400">Diff</span>
                  {diff === 0 ? (
                    <span className="text-slate-200 font-bold">0 (Equal)</span>
                  ) : (
                    <span
                      className={`font-bold ${
                        diff > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {diff > 0 ? "Put Hi OI " : "Call Hi OI "}
                      {Math.abs(diff).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-slate-600 font-mono">
        <span>Scroll = zoom · Drag = pan · Double-click = reset</span>
        <span>
          {timeframe === "default"
            ? `${sampleCount} raw samples`
            : `${sampleCount} ${TIMEFRAME_MINUTES[timeframe]}-minute samples`}
          {" · today only"}
        </span>
      </div>
    </div>
  );
}

function findNearestRow(
  rows: ChartRow[],
  timestampSeconds: number,
): ChartRow | null {
  if (!rows.length) return null;

  let nearest = rows[0];
  let smallest = Math.abs(toChartTime(rows[0].timestamp) - timestampSeconds);

  for (let i = 1; i < rows.length; i++) {
    const d = Math.abs(toChartTime(rows[i].timestamp) - timestampSeconds);
    if (d < smallest) {
      smallest = d;
      nearest = rows[i];
    }
  }

  return nearest;
}
