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
  pcr: number;
  futuresLTP: number;
  totalCallOI: number;
  totalPutOI: number;
  maxPainStrike: number;
}

interface PcrHistoryChartProps {
  data: Row[];
}

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  timestamp: string;
  pcr?: number;
  futuresLTP?: number;
  totalCallOI?: number;
  totalPutOI?: number;
  maxPainStrike?: number;
}
const INDIA_TIME_ZONE = "Asia/Kolkata";

const INDIA_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// const IST_FORMATTER = new Intl.DateTimeFormat("en-IN", {
//   timeZone: "Asia/Kolkata",
//   day: "2-digit",
//   month: "short",
//   year: "numeric",
//   hour: "2-digit",
//   minute: "2-digit",
//   second: "2-digit",
//   hour12: false,
// });

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

// function formatIST(timestamp: string) {
//   return `${IST_FORMATTER.format(new Date(timestamp))} IST`;
// }
function formatIndiaTime(timestamp: string | Date) {
  return `${INDIA_DATE_TIME_FORMATTER.format(new Date(timestamp))} IST`;
}

export default function PcrHistoryChart({ data }: PcrHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const pcrSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const dataRef = useRef<Row[]>(data);

  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    timestamp: "",
  });

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

          // return IST_FORMATTER.format(date);
          return INDIA_TIME_FORMATTER.format(date);
        },
      },
    });

    chartRef.current = chart;

    /*
     * PCR — LEFT SCALE
     */
    const pcrSeries = chart.addSeries(LineSeries, {
      color: "#22d3ee",

      lineWidth: 2,

      priceScaleId: "left",

      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },

      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,

      lastValueVisible: true,
      priceLineVisible: false,
    });

    /*
     * FUTURES — RIGHT SCALE
     */
    const priceSeries = chart.addSeries(LineSeries, {
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
    });

    pcrSeriesRef.current = pcrSeries;
    priceSeriesRef.current = priceSeries;

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
        setTooltip((previous) => ({
          ...previous,
          visible: false,
        }));

        return;
      }

      const timestamp = param.time;

      if (timestamp === undefined) {
        setTooltip((previous) => ({
          ...previous,
          visible: false,
        }));

        return;
      }

      const row = findNearestRow(dataRef.current, Number(timestamp));

      if (!row) {
        setTooltip((previous) => ({
          ...previous,
          visible: false,
        }));

        return;
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      /*
       * Keep tooltip inside chart.
       */
      const tooltipWidth = 235;
      const tooltipHeight = 165;

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
        pcr: row.pcr,
        futuresLTP: row.futuresLTP,
        totalCallOI: row.totalCallOI,
        totalPutOI: row.totalPutOI,
        maxPainStrike: row.maxPainStrike,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    /*
     * Hide tooltip when mouse leaves chart.
     */
    const handleMouseLeave = () => {
      setTooltip((previous) => ({
        ...previous,
        visible: false,
      }));
    };

    container.addEventListener("mouseleave", handleMouseLeave);

    /*
     * Cleanup
     */
    return () => {
      container.removeEventListener("mouseleave", handleMouseLeave);

      chart.unsubscribeCrosshairMove(handleCrosshairMove);

      chart.remove();

      chartRef.current = null;
      pcrSeriesRef.current = null;
      priceSeriesRef.current = null;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * UPDATE DATA
   * ---------------------------------------------------------
   */
  useEffect(() => {
    dataRef.current = data;

    const pcrSeries = pcrSeriesRef.current;
    const priceSeries = priceSeriesRef.current;
    const chart = chartRef.current;

    if (!pcrSeries || !priceSeries || !chart) return;

    if (!data || data.length === 0) {
      pcrSeries.setData([]);
      priceSeries.setData([]);
      return;
    }

    const sortedData = [...data]
      .filter(
        (row) =>
          Number.isFinite(row.pcr) &&
          Number.isFinite(row.futuresLTP) &&
          !Number.isNaN(new Date(row.timestamp).getTime()),
      )
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    /*
     * Remove duplicate timestamps.
     *
     * Lightweight Charts requires unique,
     * ascending timestamps.
     */
    const uniqueData: Row[] = [];

    const seen = new Set<number>();

    for (const row of sortedData) {
      const time = toChartTime(row.timestamp);

      if (seen.has(time)) continue;

      seen.add(time);
      uniqueData.push(row);
    }

    const pcrData = uniqueData.map((row) => ({
      time: toChartTime(row.timestamp),
      value: row.pcr,
    }));

    const priceData = uniqueData.map((row) => ({
      time: toChartTime(row.timestamp),
      value: row.futuresLTP,
    }));

    /*
     * First load.
     */
    if (!pcrSeries.data().length) {
      pcrSeries.setData(pcrData);
      priceSeries.setData(priceData);

      chart.timeScale().fitContent();

      return;
    }

    /*
     * Existing chart.
     *
     * Use update() for the newest point.
     * This prevents unnecessary full chart replacement.
     */
    const latest = uniqueData[uniqueData.length - 1];

    if (latest) {
      pcrSeries.update({
        time: toChartTime(latest.timestamp),
        value: latest.pcr,
      });

      priceSeries.update({
        time: toChartTime(latest.timestamp),
        value: latest.futuresLTP,
      });
    }
  }, [data]);

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

  const showLast = (bars: number) => {
    const chart = chartRef.current;
    if (!chart) return;

    const total = data.length;

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
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            PCR
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
            className="pointer-events-none absolute z-50 w-[235px] rounded-lg border border-slate-700 bg-slate-950/95 shadow-2xl backdrop-blur-sm px-3 py-2.5 text-[11px] font-mono"
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
                <span className="text-cyan-400">PCR</span>

                <span className="text-white font-bold">
                  {tooltip.pcr?.toFixed(3)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-indigo-400">Futures</span>

                <span className="text-white font-bold">
                  {tooltip.futuresLTP?.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Call OI</span>

                <span className="text-slate-200">
                  {tooltip.totalCallOI?.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Put OI</span>

                <span className="text-slate-200">
                  {tooltip.totalPutOI?.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Max Pain</span>

                <span className="text-slate-200">
                  {tooltip.maxPainStrike?.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HELP TEXT */}
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-slate-600 font-mono">
        <span>Scroll = zoom · Drag = pan · Double-click = reset</span>

        <span>{data.length} samples</span>
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * FIND NEAREST PCR SNAPSHOT
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

// "use client";

// import { useMemo } from "react";

// interface Row {
//   timestamp: string;
//   pcr: number;
//   futuresLTP: number;
// }

// export default function PcrHistoryChart({ data }: { data: Row[] }) {
//   const width = 900;
//   const height = 320;
//   const padding = { top: 20, right: 60, bottom: 40, left: 60 };
//   const innerW = width - padding.left - padding.right;
//   const innerH = height - padding.top - padding.bottom;

//   const { pcrPath, pricePath, pcrTicks, priceTicks, timeLabels } =
//     useMemo(() => {
//       if (data.length === 0) {
//         return {
//           pcrPath: "",
//           pricePath: "",
//           pcrTicks: [],
//           priceTicks: [],
//           timeLabels: [],
//         };
//       }

//       const pcrValues = data.map((d) => d.pcr);
//       const priceValues = data.map((d) => d.futuresLTP);

//       const pcrMin = Math.min(...pcrValues) * 0.95;
//       const pcrMax = Math.max(...pcrValues) * 1.05 || 1;
//       const priceMin = Math.min(...priceValues) * 0.999;
//       const priceMax = Math.max(...priceValues) * 1.001 || 1;

//       const x = (i: number) =>
//         padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
//       const yPcr = (v: number) =>
//         padding.top + innerH - ((v - pcrMin) / (pcrMax - pcrMin || 1)) * innerH;
//       const yPrice = (v: number) =>
//         padding.top +
//         innerH -
//         ((v - priceMin) / (priceMax - priceMin || 1)) * innerH;

//       const pcrPath = data
//         .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yPcr(d.pcr)}`)
//         .join(" ");
//       const pricePath = data
//         .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yPrice(d.futuresLTP)}`)
//         .join(" ");

//       const steps = 4;
//       const pcrTicks = Array.from({ length: steps + 1 }, (_, i) => {
//         const v = pcrMin + ((pcrMax - pcrMin) * i) / steps;
//         return { v, y: yPcr(v) };
//       });
//       const priceTicks = Array.from({ length: steps + 1 }, (_, i) => {
//         const v = priceMin + ((priceMax - priceMin) * i) / steps;
//         return { v, y: yPrice(v) };
//       });

//       const labelCount = Math.min(6, data.length);
//       const timeLabels = Array.from({ length: labelCount }, (_, i) => {
//         const idx = Math.round(
//           (i / Math.max(labelCount - 1, 1)) * (data.length - 1),
//         );
//         const t = new Date(data[idx].timestamp);
//         return {
//           x: x(idx),
//           label: t.toLocaleTimeString("en-IN", {
//             timeZone: "Asia/Kolkata",
//             hour: "2-digit",
//             minute: "2-digit",
//           }),
//         };
//       });

//       return { pcrPath, pricePath, pcrTicks, priceTicks, timeLabels };
//     }, [data, innerH, innerW, padding.left, padding.top]);

//   return (
//     <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
//       {pcrTicks.map((t, i) => (
//         <line
//           key={i}
//           x1={padding.left}
//           x2={width - padding.right}
//           y1={t.y}
//           y2={t.y}
//           stroke="#1e293b"
//           strokeWidth={1}
//         />
//       ))}

//       {/* Left axis: PCR */}
//       {pcrTicks.map((t, i) => (
//         <text
//           key={`pcr-${i}`}
//           x={padding.left - 8}
//           y={t.y + 4}
//           textAnchor="end"
//           fontSize="10"
//           fill="#22d3ee"
//           fontFamily="monospace"
//         >
//           {t.v.toFixed(2)}
//         </text>
//       ))}

//       {/* Right axis: futures / spot price */}
//       {priceTicks.map((t, i) => (
//         <text
//           key={`price-${i}`}
//           x={width - padding.right + 8}
//           y={t.y + 4}
//           textAnchor="start"
//           fontSize="10"
//           fill="#818cf8"
//           fontFamily="monospace"
//         >
//           {t.v.toFixed(0)}
//         </text>
//       ))}

//       {/* Bottom axis: time (shared by both series) */}
//       {timeLabels.map((t, i) => (
//         <text
//           key={`time-${i}`}
//           x={t.x}
//           y={height - padding.bottom + 16}
//           textAnchor="middle"
//           fontSize="10"
//           fill="#94a3b8"
//           fontFamily="monospace"
//         >
//           {t.label}
//         </text>
//       ))}

//       <path d={pcrPath} fill="none" stroke="#22d3ee" strokeWidth={2} />
//       <path
//         d={pricePath}
//         fill="none"
//         stroke="#818cf8"
//         strokeWidth={2}
//         strokeDasharray="4 2"
//       />

//       <g>
//         <circle cx={padding.left + 6} cy={12} r={4} fill="#22d3ee" />
//         <text
//           x={padding.left + 16}
//           y={16}
//           fontSize="10"
//           fill="#22d3ee"
//           fontFamily="monospace"
//         >
//           PCR (left)
//         </text>
//         <circle cx={padding.left + 110} cy={12} r={4} fill="#818cf8" />
//         <text
//           x={padding.left + 120}
//           y={16}
//           fontSize="10"
//           fill="#818cf8"
//           fontFamily="monospace"
//         >
//           Futures Price (right)
//         </text>
//       </g>
//     </svg>
//   );
// }
