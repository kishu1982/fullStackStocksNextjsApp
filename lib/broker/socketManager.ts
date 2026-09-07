"use client";
import { BrokerSocket } from "./socket";

type TickHandler = (tick: any) => void;

class BrokerSocketManager {
  private socket: BrokerSocket | null = null;
  private sessionKey: string | null = null;
  private pendingSubs = new Set<string>();
  private handlers = new Set<TickHandler>();

  init(params: { clientId: string; actid: string; susertoken: string }) {
    const key = `${params.clientId}:${params.actid}:${params.susertoken}`;
    if (this.socket && this.sessionKey === key) return;

    this.socket?.close();
    this.socket = new BrokerSocket(params);
    this.sessionKey = key;

    this.socket.onTick((msg) => {
      this.handlers.forEach((h) => h(msg));
    });

    this.socket.connect();

    this.pendingSubs.forEach((entry) => {
      const [exch, token] = entry.split("|");
      this.socket!.subscribe(exch, token);
    });
  }

  subscribe(exch: string, token: string) {
    const key = `${exch}|${token}`;
    this.pendingSubs.add(key);
    this.socket?.subscribe(exch, token);
  }

  unsubscribe(exch: string, token: string) {
    const key = `${exch}|${token}`;
    this.pendingSubs.delete(key);
    this.socket?.unsubscribe(exch, token);
  }

  onTick(handler: TickHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  isConnected() {
    return this.socket !== null;
  }
}

export const brokerSocketManager = new BrokerSocketManager();
