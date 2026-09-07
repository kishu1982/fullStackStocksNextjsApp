"use client";

import { useEffect, useState } from "react";
import { brokerSocketManager } from "@/lib/broker/socketManager";
import { Tick } from "@/types/instrument";

export function useTicks(exch: string, tokens: string[]) {
  const [ticks, setTicks] = useState<Record<string, Tick>>({});

  const tokenKey = tokens.join(",");

  useEffect(() => {
    if (!exch || tokens.length === 0) return;

    const unsubscribe = brokerSocketManager.onTick((msg: Tick) => {
      if (msg.e === exch && msg.tk && tokens.includes(String(msg.tk))) {
        setTicks((prev) => ({
          ...prev,
          [String(msg.tk)]: { ...prev[String(msg.tk)], ...msg },
        }));
      }
    });

    tokens.forEach((token) => brokerSocketManager.subscribe(exch, token));

    return () => {
      unsubscribe();
      tokens.forEach((token) => brokerSocketManager.unsubscribe(exch, token));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exch, tokenKey]);

  // console.log("useTicks: ticks updated", ticks);
  return ticks;
}
