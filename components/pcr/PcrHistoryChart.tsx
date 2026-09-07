"use client";

import { useMemo } from "react";

interface Row {
  timestamp: string;
  pcr: number;
  futuresLTP: number;
}

export default function PcrHistoryChart({ data }: { data: Row[] }) {
  const width = 900;
  const height = 320;
  const padding = { top: 20, right: 60, bottom: 40, left: 60 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const { pcrPath, pricePath, pcrTicks, priceTicks, timeLabels } =
    useMemo(() => {
      if (data.length === 0) {
        return {
          pcrPath: "",
          pricePath: "",
          pcrTicks: [],
          priceTicks: [],
          timeLabels: [],
        };
      }

      const pcrValues = data.map((d) => d.pcr);
      const priceValues = data.map((d) => d.futuresLTP);

      const pcrMin = Math.min(...pcrValues) * 0.95;
      const pcrMax = Math.max(...pcrValues) * 1.05 || 1;
      const priceMin = Math.min(...priceValues) * 0.999;
      const priceMax = Math.max(...priceValues) * 1.001 || 1;

      const x = (i: number) =>
        padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
      const yPcr = (v: number) =>
        padding.top + innerH - ((v - pcrMin) / (pcrMax - pcrMin || 1)) * innerH;
      const yPrice = (v: number) =>
        padding.top +
        innerH -
        ((v - priceMin) / (priceMax - priceMin || 1)) * innerH;

      const pcrPath = data
        .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yPcr(d.pcr)}`)
        .join(" ");
      const pricePath = data
        .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yPrice(d.futuresLTP)}`)
        .join(" ");

      const steps = 4;
      const pcrTicks = Array.from({ length: steps + 1 }, (_, i) => {
        const v = pcrMin + ((pcrMax - pcrMin) * i) / steps;
        return { v, y: yPcr(v) };
      });
      const priceTicks = Array.from({ length: steps + 1 }, (_, i) => {
        const v = priceMin + ((priceMax - priceMin) * i) / steps;
        return { v, y: yPrice(v) };
      });

      const labelCount = Math.min(6, data.length);
      const timeLabels = Array.from({ length: labelCount }, (_, i) => {
        const idx = Math.round(
          (i / Math.max(labelCount - 1, 1)) * (data.length - 1),
        );
        const t = new Date(data[idx].timestamp);
        return {
          x: x(idx),
          label: t.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      });

      return { pcrPath, pricePath, pcrTicks, priceTicks, timeLabels };
    }, [data, innerH, innerW, padding.left, padding.top]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {pcrTicks.map((t, i) => (
        <line
          key={i}
          x1={padding.left}
          x2={width - padding.right}
          y1={t.y}
          y2={t.y}
          stroke="#1e293b"
          strokeWidth={1}
        />
      ))}

      {/* Left axis: PCR */}
      {pcrTicks.map((t, i) => (
        <text
          key={`pcr-${i}`}
          x={padding.left - 8}
          y={t.y + 4}
          textAnchor="end"
          fontSize="10"
          fill="#22d3ee"
          fontFamily="monospace"
        >
          {t.v.toFixed(2)}
        </text>
      ))}

      {/* Right axis: futures / spot price */}
      {priceTicks.map((t, i) => (
        <text
          key={`price-${i}`}
          x={width - padding.right + 8}
          y={t.y + 4}
          textAnchor="start"
          fontSize="10"
          fill="#818cf8"
          fontFamily="monospace"
        >
          {t.v.toFixed(0)}
        </text>
      ))}

      {/* Bottom axis: time (shared by both series) */}
      {timeLabels.map((t, i) => (
        <text
          key={`time-${i}`}
          x={t.x}
          y={height - padding.bottom + 16}
          textAnchor="middle"
          fontSize="10"
          fill="#94a3b8"
          fontFamily="monospace"
        >
          {t.label}
        </text>
      ))}

      <path d={pcrPath} fill="none" stroke="#22d3ee" strokeWidth={2} />
      <path
        d={pricePath}
        fill="none"
        stroke="#818cf8"
        strokeWidth={2}
        strokeDasharray="4 2"
      />

      <g>
        <circle cx={padding.left + 6} cy={12} r={4} fill="#22d3ee" />
        <text
          x={padding.left + 16}
          y={16}
          fontSize="10"
          fill="#22d3ee"
          fontFamily="monospace"
        >
          PCR (left)
        </text>
        <circle cx={padding.left + 110} cy={12} r={4} fill="#818cf8" />
        <text
          x={padding.left + 120}
          y={16}
          fontSize="10"
          fill="#818cf8"
          fontFamily="monospace"
        >
          Futures Price (right)
        </text>
      </g>
    </svg>
  );
}
