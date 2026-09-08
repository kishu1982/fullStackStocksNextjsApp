import WebSocket from "ws";
import { brokerConfig } from "@/lib/broker/config";
import { setTick } from "./tickCache";

// Node-side counterpart of lib/broker/socket.ts (which uses the browser
// WebSocket API and only runs while a tab is open). This one runs inside
// the Next.js server process itself so capture keeps going with no
// dashboard tab open at all.
class ServerBrokerFeed {
  private ws: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribed = new Set<string>();
  private actid = "";
  private accesstoken = "";
  private stopped = true;

  start(actid: string, accesstoken: string) {
    this.stopped = false;
    this.actid = actid;
    this.accesstoken = accesstoken;
    this.connect();
  }

  private connect() {
    if (this.stopped) return;

    this.ws = new WebSocket(brokerConfig.wsUrl);

    this.ws.on("open", () => {
      this.send({
        t: "a",
        uid: this.actid,
        actid: this.actid,
        accesstoken: this.accesstoken,
        source: "API",
      });
    });

    this.ws.on("message", (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.t === "ck" || msg.t === "ak") {
        if (msg.s && String(msg.s).toUpperCase() === "OK") {
          this.startHeartbeat();
          this.flushSubscribed();
          console.log("✅ PCR server feed authenticated");
        } else {
          console.error("❌ PCR server feed auth rejected:", msg);
          this.ws?.close();
        }
        return;
      }

      if (["tk", "tf", "dk", "df"].includes(msg.t) && msg.tk) {
        setTick(msg.e, String(msg.tk), msg);
      }
    });

    this.ws.on("close", () => {
      this.stopHeartbeat();
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    });

    this.ws.on("error", (err) =>
      console.error("PCR server feed WS error", err),
    );
  }

  subscribe(exch: string, token: string) {
    const key = `${exch}|${token}`;
    if (this.subscribed.has(key)) return;
    this.subscribed.add(key);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.pendingQueue.push(key);
      this.scheduleQueueFlush();
    }
  }

  private pendingQueue: string[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleQueueFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPendingQueue();
    }, 20);
  }

  private flushPendingQueue() {
    if (
      this.pendingQueue.length === 0 ||
      this.ws?.readyState !== WebSocket.OPEN
    )
      return;
    const batch = this.pendingQueue.splice(0, 50);
    this.send({ t: "t", k: batch.join("#") });
    if (this.pendingQueue.length > 0) {
      this.scheduleQueueFlush();
    }
  }

  private flushSubscribed() {
    const allKeys = Array.from(this.subscribed);
    console.log(
      `[PCR][feed] flushing ${allKeys.length} subscribed tokens in batches of 50`,
    );
    this.pendingQueue = allKeys;
    this.flushPendingQueue();
  }

  private unsubscribeAll() {
    const keys = Array.from(this.subscribed);
    for (let i = 0; i < keys.length; i += 50) {
      const chunk = keys.slice(i, i + 50);
      this.send({ t: "u", k: chunk.join("#") });
    }
    this.subscribed.clear();
    this.pendingQueue = [];
  }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify(payload));
  }

  private startHeartbeat() {
    this.heartbeat = setInterval(() => this.send({ t: "h" }), 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.unsubscribeAll();
    this.ws?.close();
    this.ws = null;
  }

  isRunning() {
    return this.ws !== null && !this.stopped;
  }
}

// Singleton — one feed connection for the whole server process.
export const serverBrokerFeed = new ServerBrokerFeed();
