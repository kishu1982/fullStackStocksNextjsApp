"use client";

import { useState } from "react";
import { Instrument, Tick } from "@/types/instrument";
import OptionsChainTable from "./OptionsChainTable";
import { getOptionsForExpiry } from "@/lib/pcr/groupInstruments";

export default function FuturesRow({
  future,
  tick,
  allInstruments,
}: {
  future: Instrument;
  tick?: Tick;
  allInstruments: Instrument[];
}) {
  const [open, setOpen] = useState(false);

  const optionsForExpiry = open
    ? getOptionsForExpiry(allInstruments, future.expiry)
    : [];

  const changePercent = Number(tick?.pc || 0);
  const changeColor =
    changePercent > 0
      ? "text-emerald-400 font-semibold"
      : changePercent < 0
        ? "text-rose-400 font-semibold"
        : "text-slate-400";

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/80 shadow-md transition-all">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-slate-800/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 text-xs font-mono font-bold">
            FUT
          </div>
          <div>
            <div className="font-bold text-white text-sm sm:text-base font-mono">
              {future.tradingSymbol}
            </div>
            <div className="text-[11px] text-slate-400 font-sans">
              Expiry:{" "}
              <span className="font-mono text-slate-300 font-medium">
                {future.expiry}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right">
            <div
              className={`font-mono font-bold text-sm sm:text-base ${
                changePercent > 0
                  ? "text-emerald-400"
                  : changePercent < 0
                    ? "text-rose-400"
                    : "text-slate-100"
              }`}
            >
              {tick?.lp ? Number(tick.lp).toFixed(2) : "—"}
            </div>
            <div className={`text-xs font-mono ${changeColor}`}>
              {changePercent > 0 ? `+${tick?.pc}` : (tick?.pc ?? "0.00")}%
            </div>
          </div>

          <div
            className={`w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 transition-transform duration-200 ${
              open ? "rotate-180 text-cyan-400 border-cyan-500/40" : ""
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      {open && optionsForExpiry.length > 0 && (
        <OptionsChainTable options={optionsForExpiry} />
      )}
      {open && optionsForExpiry.length === 0 && (
        <div className="p-4 text-xs font-sans text-slate-500 border-t border-slate-800 bg-slate-950/40">
          No options contracts found for this expiry.
        </div>
      )}
    </div>
  );
}
