"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
// import {
//   saveSession,
//   getSession,
//   BrokerSession,
// } from "@/lib/broker/tokenClient";
import type { BrokerSession } from "@/lib/broker/tokenClient";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useTicks } from "@/hooks/useTicks";

const PriceCell = ({ value }: { value: any }) => {
  const prevValueRef = useRef(value);

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  const prevValue = prevValueRef.current;

  let textColor = "text-slate-200 font-mono font-semibold";
  if (value > prevValue)
    textColor = "text-emerald-400 font-mono font-bold animate-pulse";
  if (value < prevValue)
    textColor = "text-rose-400 font-mono font-bold animate-pulse";

  return <span className={textColor}>{value ?? "—"}</span>;
};

export default function DashboardContent() {
  const [session, setSession] = useState<BrokerSession | null>(null);
  const [niftyToken, setNiftyToken] = useState<string | null>(null);

  // now work based on db token only
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/broker/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          window.location.href = "/login?error=session_expired";
          return;
        }

        const data = await response.json();

        if (!data.authenticated || !data.session) {
          window.location.href = "/login?error=session_expired";
          return;
        }

        if (!cancelled) {
          setSession(data.session);
        }
      } catch (error) {
        console.error("Failed to load broker session:", error);
        window.location.href = "/login?error=session_expired";
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch("/api/broker/nifty-future-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: session.uid, jKey: session.accessToken }),
    })
      .then((r) => r.json())
      .then((d) => setNiftyToken(d.nearest?.token ?? null))
      .catch((err) =>
        console.error("Failed to resolve Nifty future token", err),
      );
  }, [session]);

  useSessionGuard(session);

  function formatEpochToIST(epochStr: string | undefined): string {
    if (!epochStr) return "—";
    const timestamp = Number(epochStr) * 1000;
    return isNaN(timestamp)
      ? "—"
      : new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "medium",
          hour12: true,
        }).format(new Date(timestamp));
  }

  const ticks = useTicks("NFO", niftyToken ? [niftyToken] : []);
  const tick = niftyToken ? ticks[niftyToken] : null;

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 bg-slate-800/80 px-6 py-4 rounded-xl border border-slate-700 shadow-xl">
          <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-300 font-medium text-sm">
            Authenticating Broker Session…
          </p>
        </div>
      </div>
    );
  }

  const tickEntries = Object.entries(ticks);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Welcome back,{" "}
            <span className="text-cyan-400 font-mono">{session?.uid}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Moneysukh WebSocket feeds for NFO / MCX contracts.
          </p>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3">
          <div className="bg-slate-900/80 border border-slate-800 px-4 py-2.5 rounded-xl">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              NIFTY FUT Price
            </span>
            <span className="text-base font-mono font-bold text-cyan-400">
              {tick?.lp ? Number(tick.lp).toFixed(2) : "—"}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 px-4 py-2.5 rounded-xl">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              Feed IST Time
            </span>
            <span className="text-xs font-mono text-slate-200">
              {formatEpochToIST(
                Object.values(ticks).find((t: any) => t.ft)?.ft,
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Live Market Ticker Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Active Market Watch
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {tickEntries.length} Active Stream
            {tickEntries.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-xl bg-slate-900/60">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-800/90 text-slate-400 uppercase tracking-wider text-[11px] font-sans border-b border-slate-700/80">
                <th className="p-3.5 font-semibold">Symbol</th>
                <th className="p-3.5 font-semibold text-right">LTP / Time</th>
                <th className="p-3.5 font-semibold text-right">Change %</th>
                <th className="p-3.5 font-semibold text-right text-emerald-400">
                  Bid (Buy)
                </th>
                <th className="p-3.5 font-semibold text-right text-rose-400">
                  Ask (Sell)
                </th>
                <th className="p-3.5 font-semibold text-right">Volume</th>
                <th className="p-3.5 font-semibold text-right">Open</th>
                <th className="p-3.5 font-semibold text-right text-emerald-400">
                  High
                </th>
                <th className="p-3.5 font-semibold text-right text-rose-400">
                  Low
                </th>
                <th className="p-3.5 font-semibold text-right">Prev Close</th>
                <th className="p-3.5 font-semibold text-right text-sky-400">
                  OI
                </th>
                <th className="p-3.5 font-semibold text-center text-slate-500 font-sans">
                  Token
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tickEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="p-8 text-center text-slate-500 font-sans"
                  >
                    Connecting to live ticker stream…
                  </td>
                </tr>
              ) : (
                tickEntries.map(([token, item]: [string, any]) => {
                  const changeValue = parseFloat(item.pc || "0");
                  const changeColor =
                    changeValue > 0
                      ? "text-emerald-400 font-semibold"
                      : changeValue < 0
                        ? "text-rose-400 font-semibold"
                        : "text-slate-300";

                  return (
                    <tr
                      key={token}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3.5 font-sans font-bold text-white border-r border-slate-800">
                        <span className="text-cyan-400 font-mono text-[11px] mr-1.5">
                          [NFO]
                        </span>
                        {item.ts || "NIFTY FUT"}
                      </td>

                      <td className="p-3.5 text-right bg-slate-900/40">
                        <PriceCell value={item.lp} />
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                          {item.ltt ?? "—"}
                        </div>
                      </td>

                      <td className={`p-3.5 text-right ${changeColor}`}>
                        {changeValue > 0 ? `+${item.pc}` : (item.pc ?? "0.00")}%
                      </td>

                      <td className="p-3.5 text-right text-emerald-400">
                        {item.bp1 ?? "—"}
                      </td>
                      <td className="p-3.5 text-right text-rose-400">
                        {item.sp1 ?? "—"}
                      </td>

                      <td className="p-3.5 text-right text-slate-300">
                        {item.v ? Number(item.v).toLocaleString() : "—"}
                      </td>

                      <td className="p-3.5 text-right text-slate-400">
                        {item.o ?? "—"}
                      </td>
                      <td className="p-3.5 text-right text-emerald-400/90">
                        {item.h ?? "—"}
                      </td>
                      <td className="p-3.5 text-right text-rose-400/90">
                        {item.l ?? "—"}
                      </td>

                      <td className="p-3.5 text-right text-slate-400">
                        {item.c ?? "—"}
                      </td>

                      <td className="p-3.5 text-right text-sky-400 font-semibold">
                        {item.oi ? Number(item.oi).toLocaleString() : "—"}
                      </td>

                      <td className="p-3.5 text-center text-slate-500 font-sans text-[10px]">
                        {token}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
