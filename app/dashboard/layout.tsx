"use client";

import { useEffect, useState } from "react";

import type { BrokerSession } from "@/lib/broker/tokenClient";

import { useBrokerConnection } from "@/hooks/useBrokerConnection";
import { useSessionGuard } from "@/hooks/useSessionGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<BrokerSession | null>(null);

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

        if (!data?.authenticated || !data?.session) {
          window.location.href = "/login?error=session_expired";
          return;
        }

        if (!cancelled) {
          setSession(data.session);
        }
      } catch (error) {
        console.error("Dashboard session check failed:", error);

        if (!cancelled) {
          window.location.href = "/login?error=session_expired";
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useBrokerConnection(session);

  useSessionGuard(session);

  return <>{children}</>;
}
