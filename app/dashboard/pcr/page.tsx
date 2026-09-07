"use client";

import { useEffect, useMemo, useState } from "react";
import { Instrument } from "@/types/instrument";
import { getFutures } from "@/lib/pcr/groupInstruments";
import { useTicks } from "@/hooks/useTicks";
import FuturesRow from "@/components/pcr/FuturesRow";

const SYMBOLS = ["NIFTY", "BANKNIFTY", "SENSEX"];

export default function PCRPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const exchange = symbol === "NIFTY" || symbol === "BANKNIFTY" ? "NFO" : "BFO";
        const res = await fetch(
          `/api/instruments?symbol=${symbol}&exchange=${exchange}&matchType=strict`
        );
        const json = await res.json();
        if (!cancelled) setInstruments(json.data || []);
      } catch (err) {
        console.error("Failed to load instruments", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const futures = useMemo(() => getFutures(instruments), [instruments]);
  const futureTokens = useMemo(() => futures.map((f) => f.token), [futures]);
  const futureTicks = useTicks(futures[0]?.exchange || "NFO", futureTokens);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Title & Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Futures & Options PCR Data
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Put-Call Ratio analytics & active option chain breakdown.
          </p>
        </div>

        {/* Index Symbol Selector Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                symbol === s
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="flex items-center justify-center p-8 bg-slate-900/40 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Loading {symbol} contracts…</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && futures.length === 0 && (
        <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-sm text-slate-500">
          No active FUTIDX contracts found for <span className="font-semibold text-slate-300">{symbol}</span>.
        </div>
      )}

      {/* Futures List */}
      {!loading && futures.length > 0 && (
        <div className="space-y-3">
          {futures.map((future) => (
            <FuturesRow
              key={future.token}
              future={future}
              tick={futureTicks[future.token]}
              allInstruments={instruments}
            />
          ))}
        </div>
      )}
    </div>
  );
}

