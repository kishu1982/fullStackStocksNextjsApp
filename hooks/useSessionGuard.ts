"use client";

import { useEffect } from "react";

import type { BrokerSession } from "@/lib/broker/tokenClient";

function msUntilNextISTMidnight(): number {
  const now = new Date();

  const istNowStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  // Parse "MM/DD/YYYY, HH:mm:ss"
  const [datePart, timePart] = istNowStr.split(", ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  // Keep these variables so the date parsing remains explicit.
  void month;
  void day;
  void year;

  const secondsSinceISTMidnight = hour * 3600 + minute * 60 + second;

  const secondsUntilNextISTMidnight = 24 * 3600 - secondsSinceISTMidnight;

  return secondsUntilNextISTMidnight * 1000;
}

export function useSessionGuard(session: BrokerSession | null) {
  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    const expireNow = () => {
      if (cancelled) return;

      window.location.href = "/login?error=session_expired";
    };

    const checkSession = async () => {
      try {
        const response = await fetch("/api/broker/session", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          expireNow();
          return;
        }

        const data = await response.json();

        if (!data?.authenticated || !data?.session) {
          expireNow();
        }
      } catch (error) {
        console.error("Session validation failed:", error);
        expireNow();
      }
    };

    // Check immediately when the guard starts.
    checkSession();

    // Check the database-backed session every 60 seconds.
    const interval = setInterval(checkSession, 60_000);

    // Force the session to expire at the next IST midnight.
    const timer = setTimeout(expireNow, msUntilNextISTMidnight());

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [session]);
}
