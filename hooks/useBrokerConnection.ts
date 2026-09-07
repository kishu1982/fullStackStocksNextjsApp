"use client";
import { useEffect } from "react";
import { brokerSocketManager } from "@/lib/broker/socketManager";
import type { BrokerSession } from "@/lib/broker/tokenClient";

export function useBrokerConnection(session: BrokerSession | null) {
  useEffect(() => {
    if (!session) return;
    brokerSocketManager.init({
      clientId: process.env.NEXT_PUBLIC_BROKER_ACC_ID!,
      actid: session.uid,
      susertoken: session.accessToken,
    });
  }, [session?.uid, session?.accessToken]);
}
