"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginCardContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (err: string) => {
    if (err === "session_expired") return "Your trading session has expired. Please sign in again.";
    if (err === "no_code") return "Authentication failed: Authorization code was missing.";
    return decodeURIComponent(err);
  };

  return (
    <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Broker Authentication
        </h1>
        <p className="text-xs text-slate-400">
          Secure OAuth 2.0 authentication with Moneysukh Trading API
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-sans flex items-start gap-2.5">
          <svg className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{getErrorMessage(error)}</span>
        </div>
      )}

      {/* Feature Bullet List */}
      <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 text-xs text-slate-300">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span>Live WebSocket stream for NFO & MCX contracts</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Real-time Put-Call Ratio (PCR) analytics</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          <span>Automatic session validation until midnight IST</span>
        </div>
      </div>

      {/* Login Button */}
      <button
        onClick={() => (window.location.href = "/api/broker/authorize")}
        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        Sign In with Moneysukh Broker
      </button>

      <p className="text-[11px] text-center text-slate-500">
        You will be securely redirected to Moneysukh to approve access.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading login portal…</div>}>
        <LoginCardContent />
      </Suspense>
    </div>
  );
}

