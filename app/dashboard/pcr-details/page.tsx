"use client";

import { useEffect, useState } from "react";
import PcrHistoryChart from "@/components/pcr/PcrHistoryChart";

// const SYMBOLS = ["NIFTY", "BANKNIFTY", "SENSEX"];
const SYMBOLS = ["NIFTY", "SENSEX"];

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
          `/api/pcr?symbol=${symbol}&expiry=${encodeURIComponent(expiry)}&limit=300`,
        );
        const json = await res.json();
        if (!cancelled && json.success) setRows(json.data);
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

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-white">PCR Details</h1>
          <p className="text-xs text-slate-400 mt-1">
            Stored PCR, Max Pain &amp; Futures price — refreshes every 10
            seconds.
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              label={`${symbol} Future`}
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
