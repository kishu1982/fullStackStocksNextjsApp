"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import PcrHistoryChart from "@/components/pcr/PcrHistoryChart";
import PcrOiFuturesChart from "@/components/pcr/PcrOiFuturesChart"; // for oi chart component

// const SYMBOLS = ["NIFTY", "BANKNIFTY", "SENSEX"];
//const SYMBOLS = ["NIFTY", "SENSEX"];
const SYMBOLS = ["NIFTY"];

interface PcrSnapshotRow {
  id: string;
  symbol: string;
  expiry: string;
  timestamp: string;
  pcr: number;
  totalCallOI: number;
  totalPutOI: number;
  maxPainStrike: number;
  futuresLTP: number;
}
// for change in pe and call oi
const IST_DATE_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
}); // gives YYYY-MM-DD in IST

interface OiChange {
  openingTime: string;
  callOpen: number;
  callNow: number;
  callChange: number;
  callPct: number;
  putOpen: number;
  putNow: number;
  putChange: number;
  putPct: number;
}

function getOiChange(rows: PcrSnapshotRow[]): OiChange | null {
  const sorted = rows
    .filter((r) => !Number.isNaN(new Date(r.timestamp).getTime()))
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  if (sorted.length === 0) return null;

  const latest = sorted[sorted.length - 1];
  const todayKey = IST_DATE_KEY.format(new Date(latest.timestamp));

  // First snapshot received on the same IST day as the latest snapshot
  const opening = sorted.find(
    (r) => IST_DATE_KEY.format(new Date(r.timestamp)) === todayKey,
  );

  if (!opening) return null;

  const callOpen = Number(opening.totalCallOI || 0);
  const putOpen = Number(opening.totalPutOI || 0);
  const callNow = Number(latest.totalCallOI || 0);
  const putNow = Number(latest.totalPutOI || 0);

  return {
    openingTime: opening.timestamp,
    callOpen,
    callNow,
    callChange: callNow - callOpen,
    callPct: callOpen > 0 ? ((callNow - callOpen) / callOpen) * 100 : 0,
    putOpen,
    putNow,
    putChange: putNow - putOpen,
    putPct: putOpen > 0 ? ((putNow - putOpen) / putOpen) * 100 : 0,
  };
}

interface PcrRange {
  high: number;
  highTime: string;
  low: number;
  lowTime: string;
  open: number;
  openTime: string;
  now: number;
  change: number; // points: now - open
  changePct: number; // % change vs open
}

function getPcrDayRange(rows: PcrSnapshotRow[]): PcrRange | null {
  const valid = rows.filter(
    (r) =>
      Number.isFinite(Number(r.pcr)) &&
      !Number.isNaN(new Date(r.timestamp).getTime()),
  );

  if (valid.length === 0) return null;

  // IST day of the most recent snapshot
  const latestMs = Math.max(
    ...valid.map((r) => new Date(r.timestamp).getTime()),
  );
  const todayKey = IST_DATE_KEY.format(new Date(latestMs));

  let high: PcrSnapshotRow | null = null;
  let low: PcrSnapshotRow | null = null;
  let first: PcrSnapshotRow | null = null; // first snapshot of the day
  let last: PcrSnapshotRow | null = null; // latest snapshot of the day

  const ms = (r: PcrSnapshotRow) => new Date(r.timestamp).getTime();

  for (const r of valid) {
    if (IST_DATE_KEY.format(new Date(r.timestamp)) !== todayKey) continue;

    if (!high || r.pcr > high.pcr) high = r;
    if (!low || r.pcr < low.pcr) low = r;
    if (!first || ms(r) < ms(first)) first = r;
    if (!last || ms(r) > ms(last)) last = r;
  }

  if (!high || !low || !first || !last) return null;

  const change = last.pcr - first.pcr;

  return {
    high: high.pcr,
    highTime: high.timestamp,
    low: low.pcr,
    lowTime: low.timestamp,
    open: first.pcr,
    openTime: first.timestamp,
    now: last.pcr,
    change,
    changePct: first.pcr !== 0 ? (change / first.pcr) * 100 : 0,
  };
}

function formatTimeIST(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
export default function PcrDetailsPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<string>("");
  const [rows, setRows] = useState<PcrSnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-populate the expiry dropdown from whatever's actually stored for this symbol.
  useEffect(() => {
    let cancelled = false;
    setExpiry("");
    setRows([]);

    (async () => {
      try {
        const res = await fetch(`/api/pcr/expiries?symbol=${symbol}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setExpiries(json.data);
          if (json.data.length > 0) setExpiry(json.data[0]);
        }
      } catch (err) {
        console.error("Failed to load expiries", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Poll every 10s once a symbol + expiry is selected.
  useEffect(() => {
    if (!symbol || !expiry) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pcr?symbol=${symbol}&expiry=${encodeURIComponent(expiry)}&limit=5000`,
        );
        // means 5000 × 10 sec
        // = 50,000 sec
        // ≈ 13.9 hours
        const json = await res.json();

        if (!cancelled && json.success) {
          const normalizedRows = json.data.map((row: PcrSnapshotRow) => {
            const callOI = Number(row.totalCallOI || 0);
            const putOI = Number(row.totalPutOI || 0);

            const calculatedPCR =
              callOI > 0 ? putOI / callOI : Number(row.pcr || 0);

            return {
              ...row,
              pcr: calculatedPCR,
            };
          });

          // to check data
          console.log("[PCR UI]", {
            latestRawPCR: json.data?.[json.data.length - 1]?.pcr,
            latestCallOI: json.data?.[json.data.length - 1]?.totalCallOI,
            latestPutOI: json.data?.[json.data.length - 1]?.totalPutOI,
            calculatedPCR: normalizedRows?.[normalizedRows.length - 1]?.pcr,
          });
          setRows(normalizedRows);
        }
      } catch (err) {
        console.error("Failed to load PCR data", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol, expiry]);

  const latest = rows[rows.length - 1];
  // for call put oi change
  const oiChange = useMemo(() => getOiChange(rows), [rows]);
  // getting high low  data
  const pcrRange = useMemo(() => getPcrDayRange(rows), [rows]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-white">PCR Details</h1>
          <p className="text-xs text-slate-400 mt-1">
            Stored PCR, Max Pain &amp; Futures price — refreshes selected TF
            raw/1 minute seconds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            disabled={expiries.length === 0}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 min-w-[150px]"
          >
            {expiries.length === 0 && (
              <option value="">No stored expiries yet</option>
            )}
            {expiries.map((exp) => (
              <option key={exp} value={exp}>
                {exp}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!expiry && (
        <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-sm text-slate-500">
          No stored data yet for {symbol}. Auto-capture runs 9:00–16:00 IST —
          check back once the market is open.
        </div>
      )}

      {expiry && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="PCR"
              value={latest ? latest.pcr.toFixed(5) : "—"}
              subText={
                latest
                  ? latest.pcr > 1
                    ? "Put OI Higher"
                    : "Call OI is Higher"
                  : undefined
              }
              accent={latest && latest.pcr > 1 ? "emerald" : "rose"}
            />
            <StatCard
              label="Max Pain"
              value={latest ? latest.maxPainStrike.toLocaleString() : "—"}
              accent="cyan"
            />
            <StatCard
              // label={`${symbol} spot / Futures LTP`}
              label={`${symbol} spot / LTP`}
              value={latest ? latest.futuresLTP.toFixed(2) : "—"}
              accent="indigo"
            />
            <StatCard
              label="Call OI / Put OI"
              value={
                latest
                  ? `${latest.totalCallOI.toLocaleString()} / ${latest.totalPutOI.toLocaleString()}`
                  : "—"
              }
              accent="slate"
            />
            <PcrRangeCard range={pcrRange} />
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            {rows.length > 1 ? (
              <PcrHistoryChart data={rows} />
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">
                {loading
                  ? "Loading chart data…"
                  : "Waiting for more samples to plot a trend…"}
              </div>
            )}
          </div>
          {/* CHANGE IN OI CARDS */}
          {oiChange && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <OiChangeCard
                label="Change in Call OI"
                change={oiChange.callChange}
                pct={oiChange.callPct}
                open={oiChange.callOpen}
                now={oiChange.callNow}
                openingTime={oiChange.openingTime}
                accent="rose"
              />
              <OiChangeCard
                label="Change in Put OI"
                change={oiChange.putChange}
                pct={oiChange.putPct}
                open={oiChange.putOpen}
                now={oiChange.putNow}
                openingTime={oiChange.openingTime}
                accent="emerald"
              />
            </div>
          )}

          {/* NEW: add this block right below */}

          {/* NEW: add this block right below */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mt-6">
            {rows.length > 1 ? (
              <PcrOiFuturesChart data={rows} />
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">
                {loading
                  ? "Loading chart data…"
                  : "Waiting for more samples to plot a trend…"}
              </div>
            )}
          </div>

          {latest && (
            <div className="text-[11px] text-slate-500 font-mono">
              Last updated:{" "}
              {new Date(latest.timestamp).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subText,
  accent,
}: {
  label: string;
  value: string;
  subText?: string;
  accent: string;
}) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-400 border-emerald-800 bg-emerald-950/40",
    rose: "text-rose-400 border-rose-800 bg-rose-950/40",
    cyan: "text-cyan-400 border-cyan-800 bg-cyan-950/40",
    indigo: "text-indigo-400 border-indigo-800 bg-indigo-950/40",
    slate: "text-slate-300 border-slate-700 bg-slate-900/60",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-sans mb-1">
        {label}
      </div>
      <div className="text-lg font-bold font-mono">{value}</div>

      {subText && (
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
          {subText}
        </div>
      )}
    </div>
  );
}

function OiChangeCard({
  label,
  change,
  pct,
  open,
  now,
  openingTime,
  accent,
}: {
  label: string;
  change: number;
  pct: number;
  open: number;
  now: number;
  openingTime: string;
  accent: "rose" | "emerald";
}) {
  const colors = {
    rose: "text-rose-400 border-rose-800 bg-rose-950/40",
    emerald: "text-emerald-400 border-emerald-800 bg-emerald-950/40",
  };

  const sign = change > 0 ? "+" : "";
  const openTimeIST = new Date(openingTime).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-lg font-bold font-mono">
          {sign}
          {change.toLocaleString("en-IN")}
        </div>

        <div className="text-xs font-mono font-semibold">
          {sign}
          {pct.toFixed(2)}%
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-mono text-slate-400">
        <span>
          Open ({openTimeIST}): {open.toLocaleString("en-IN")}
        </span>
        <span>Now: {now.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
}
{
  /* <-- this closing brace belongs here, ends OiChangeCard */
}

function PcrRangeCard({ range }: { range: PcrRange | null }) {
  const up = range ? range.change >= 0 : true;
  const sign = range && range.change > 0 ? "+" : "";

  return (
    <div className="col-span-2 sm:col-span-1 rounded-xl border p-4 text-amber-400 border-amber-800 bg-amber-950/40">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-sans mb-1">
        PCR Day High / Low / Change
      </div>

      {range ? (
        <div className="space-y-0.5 font-mono">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-emerald-400">
              H {range.high.toFixed(4)}
            </span>
            <span className="text-[10px] text-slate-400">
              {formatTimeIST(range.highTime)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-rose-400">
              L {range.low.toFixed(4)}
            </span>
            <span className="text-[10px] text-slate-400">
              {formatTimeIST(range.lowTime)}
            </span>
          </div>

          {/* Change during the day */}
          <div className="mt-1.5 pt-1.5 border-t border-slate-700/60">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`text-sm font-bold ${
                  up ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {sign}
                {range.change.toFixed(4)}
              </span>
              <span
                className={`text-xs font-semibold ${
                  up ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {sign}
                {range.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Open {range.open.toFixed(4)} ({formatTimeIST(range.openTime)})
            </div>
          </div>
        </div>
      ) : (
        <div className="text-lg font-bold font-mono">—</div>
      )}
    </div>
  );
}
