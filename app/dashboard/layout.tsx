"use client";

import { useEffect, useState } from "react";
import { getSession, BrokerSession } from "@/lib/broker/tokenClient";
import { useBrokerConnection } from "@/hooks/useBrokerConnection";
import { useSessionGuard } from "@/hooks/useSessionGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<BrokerSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  useBrokerConnection(session);
  useSessionGuard(session); // redirects to /login the moment the token dies, from anywhere under /dashboard

  return <>{children}</>;
}
