"use client";

import { useMemo } from "react";
import { Instrument } from "@/types/instrument";
import { useTicks } from "@/hooks/useTicks";
import { groupByStrike } from "@/lib/pcr/groupInstruments";

function num(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function OptionsChainTable({
  options,
}: {
  options: Instrument[];
}) {
  const exch = options[0]?.exchange || "NFO";
  const tokens = useMemo(() => options.map((o) => o.token), [options]);
  const ticks = useTicks(exch, tokens);

  const strikeRows = useMemo(() => groupByStrike(options), [options]);

  const { totalCallOI, totalPutOI, pcr } = useMemo(() => {
    let callOI = 0;
    let putOI = 0;
    for (const opt of options) {
      const oi = num(ticks[opt.token]?.oi);
      if (opt.optionType === "CE") callOI += oi;
      if (opt.optionType === "PE") putOI += oi;
    }
    return {
      totalCallOI: callOI,
      totalPutOI: putOI,
      pcr: callOI > 0 ? (putOI / callOI).toFixed(2) : "—",
    };
  }, [options, ticks]);

  const pcrNumber = parseFloat(pcr);
  const pcrBadgeColor =
    !isNaN(pcrNumber) && pcrNumber >= 1
      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
      : "bg-rose-950/80 text-rose-400 border-rose-800";

  return (
    <div className="border-t border-slate-800 bg-slate-950/60 p-4 space-y-4">
      {/* Expiry PCR Stats Header */}
      <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:gap-4 text-xs">
        <div
          className={`px-3 py-2 rounded-xl border flex items-center gap-2 ${pcrBadgeColor}`}
        >
          <span className="text-[10px] uppercase font-sans tracking-wider text-slate-400 font-semibold">
            Expiry PCR:
          </span>
          <span className="font-mono font-bold text-sm">{pcr}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl flex items-center gap-2">
          <span className="text-[10px] uppercase font-sans tracking-wider text-emerald-400 font-semibold">
            Call OI (CE):
          </span>
          <span className="font-mono font-semibold text-slate-200">
            {totalCallOI.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl flex items-center gap-2">
          <span className="text-[10px] uppercase font-sans tracking-wider text-rose-400 font-semibold">
            Put OI (PE):
          </span>
          <span className="font-mono font-semibold text-slate-200">
            {totalPutOI.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/90 shadow-inner">
        <table className="w-full text-xs font-mono border-collapse text-left">
          <thead>
            <tr className="bg-slate-800/90 text-slate-400 uppercase tracking-wider text-[10px] font-sans border-b border-slate-800">
              <th className="p-2.5 text-right text-emerald-400 font-semibold">
                CE OI
              </th>
              <th className="p-2.5 text-right font-semibold">CE LTP</th>
              <th className="p-2.5 text-right font-semibold">CE Chg%</th>
              <th className="p-2.5 text-center font-bold text-cyan-400 bg-slate-800/60 border-x border-slate-700">
                Strike
              </th>
              <th className="p-2.5 text-left font-semibold">PE Chg%</th>
              <th className="p-2.5 text-left font-semibold">PE LTP</th>
              <th className="p-2.5 text-left text-rose-400 font-semibold">
                PE OI
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {strikeRows.map((row) => {
              const ceTick = row.ce ? ticks[row.ce.token] : undefined;
              const peTick = row.pe ? ticks[row.pe.token] : undefined;

              const ceChg = num(ceTick?.pc);
              const peChg = num(peTick?.pc);

              return (
                <tr
                  key={row.strikePrice}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  <td className="p-2.5 text-right text-emerald-400/90 font-medium">
                    {ceTick?.oi ? Number(ceTick.oi).toLocaleString() : "—"}
                  </td>
                  <td className="p-2.5 text-right text-slate-200">
                    {ceTick?.lp ?? "—"}
                  </td>
                  <td
                    className={`p-2.5 text-right ${
                      ceChg > 0
                        ? "text-emerald-400 font-semibold"
                        : ceChg < 0
                          ? "text-rose-400 font-semibold"
                          : "text-slate-400"
                    }`}
                  >
                    {ceTick?.pc
                      ? ceChg > 0
                        ? `+${ceTick.pc}`
                        : ceTick.pc
                      : "—"}
                  </td>

                  {/* Strike Price Center Column */}
                  <td className="p-2.5 text-center font-bold text-white bg-slate-800/50 border-x border-slate-700/60 font-mono">
                    {row.strikePrice}
                  </td>

                  <td
                    className={`p-2.5 text-left ${
                      peChg > 0
                        ? "text-emerald-400 font-semibold"
                        : peChg < 0
                          ? "text-rose-400 font-semibold"
                          : "text-slate-400"
                    }`}
                  >
                    {peTick?.pc
                      ? peChg > 0
                        ? `+${peTick.pc}`
                        : peTick.pc
                      : "—"}
                  </td>
                  <td className="p-2.5 text-left text-slate-200">
                    {peTick?.lp ?? "—"}
                  </td>
                  <td className="p-2.5 text-left text-rose-400/90 font-medium">
                    {peTick?.oi ? Number(peTick.oi).toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
