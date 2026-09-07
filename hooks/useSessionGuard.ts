"use client";
import { useEffect } from "react";
import {
  getSession,
  clearSession,
  BrokerSession,
} from "@/lib/broker/tokenClient";

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
  // Parse "MM/DD/YYYY, HH:mm:ss" → build today's + tomorrow's IST midnight in real time
  const [datePart, timePart] = istNowStr.split(", ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  const secondsSinceISTMidnight = hour * 3600 + minute * 60 + second;
  const secondsUntilNextISTMidnight = 24 * 3600 - secondsSinceISTMidnight;
  return secondsUntilNextISTMidnight * 1000;
}

export function useSessionGuard(session: BrokerSession | null) {
  useEffect(() => {
    if (!session) return;

    const expireNow = () => {
      clearSession();
      window.location.href = "/login?error=session_expired";
    };

    if (!getSession()) {
      expireNow();
      return;
    }

    const timer = setTimeout(expireNow, msUntilNextISTMidnight());
    const interval = setInterval(() => {
      if (!getSession()) {
        clearTimeout(timer);
        clearInterval(interval);
        expireNow();
      }
    }, 60_000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [session]);
}
