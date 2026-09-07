"use client";

type TickHandler = (tick: any) => void;

interface BrokerSocketOptions {
  clientId: string; // WS "uid" field — the OAuth Client ID, e.g. STFBK33_U
  actid: string; // real account id, e.g. STFBK33
  susertoken: string;
  url?: string;
}

export class BrokerSocket {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribedKeys = new Set<string>();
  private handlers = new Set<TickHandler>();
  private authFailed = false;

  private clientId: string;
  private actid: string;
  private susertoken: string;
  private url: string;

  constructor(options: BrokerSocketOptions) {
    this.clientId = options.clientId;
    this.actid = options.actid;
    this.susertoken = options.susertoken;
    this.url = options.url ?? process.env.NEXT_PUBLIC_BROKER_WS_URL!;
  }

  connect() {
    if (!this.url) {
      console.error("BrokerSocket: no WebSocket URL configured");
      return;
    }
    if (!this.susertoken) {
      console.error("BrokerSocket: no susertoken provided — aborting connect");
      return;
    }
    this.authFailed = false;

    console.log("Broker WS connecting with:", {
      clientId: this.clientId,
      actid: this.actid,
      tokenPreview: this.susertoken.slice(0, 8) + "...",
    });

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      const connectPayload = {
        t: "a",
        // uid: this.clientId, // NOT this.uid — that property doesn't exist anymore
        uid: this.actid, // NOT this.uid — that property doesn't exist anymore
        actid: this.actid,

        // susertoken: this.susertoken,
        accesstoken: this.susertoken,
        source: "API",
      };
      // console.log("========== WS AUTH DEBUG ==========");
      // console.log("URL:", this.url);
      // console.log("uid:", JSON.stringify(this.clientId));
      // console.log("actid:", JSON.stringify(this.actid));
      // console.log("source:", JSON.stringify(connectPayload.source));
      // console.log("token length:", this.susertoken?.length);
      // console.log("token preview:", this.susertoken?.slice(0, 8) + "...");
      // console.log("payload:", {
      //   ...connectPayload,
      //   susertoken: "***",
      // });
      // console.log("===================================");

      this.send(connectPayload);
    };

    this.ws.onmessage = (event) => {
      console.log("========== BROKER WS MESSAGE ==========");
      console.log("RAW:", event.data);
      console.log("=======================================");

      let msg: any;

      try {
        msg = JSON.parse(event.data);
      } catch (error) {
        console.error("❌ Invalid JSON from broker:", event.data);
        return;
      }

      console.log("Parsed broker message:", msg);

      // 🛠️ FIX 1: Support both "ak" and "ck" response types from the server
      if (msg.t === "ck" || msg.t === "ak") {
        // 🛠️ FIX 2: Universal case-insensitive status verification ("OK" or "Ok")
        if (msg.s && msg.s.toUpperCase() === "OK") {
          console.log("✅ BROKER WS AUTHENTICATED");

          this.startHeartbeat();

          this.subscribedKeys.forEach((k) => {
            console.log("📡 Subscribing:", k);
            this.send({
              t: "t",
              k,
            });
          });
        } else {
          console.error("❌ BROKER WS AUTH REJECTED:", msg);

          this.authFailed = true;
          this.ws?.close();
        }

        return;
      }

      // if (msg.t === "tk" || msg.t === "tf") {
      //   console.log("📈 TICK:", msg);
      //   this.handlers.forEach((h) => h(msg));
      // }
      //
      // Catch ALL tick and feed variants (tk = tick ack, tf = tick feed, dk = depth ack, df = depth feed)
      if (["tk", "tf", "dk", "df"].includes(msg.t)) {
        console.log(
          "📈 LIVE BROKER TICK RECEIVED:",
          JSON.stringify(msg, null, 2),
        );
        this.handlers.forEach((h) => h(msg));
      }
    };
    this.ws.onclose = (event) => {
      console.warn("Broker WS closed", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      this.stopHeartbeat();
      if (this.authFailed) {
        console.error(
          "Not reconnecting — authentication was rejected, need a fresh login.",
        );
        return;
      }
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => console.error("Broker WS error", err);
  }

  subscribe(exch: string, token: string) {
    const key = `${exch}|${token}`;
    this.subscribedKeys.add(key);
    this.send({ t: "t", k: key });
  }

  unsubscribe(exch: string, token: string) {
    const key = `${exch}|${token}`;
    this.subscribedKeys.delete(key);
    this.send({ t: "u", k: key });
  }

  onTick(handler: TickHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify(payload));
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => this.send({ t: "h" }), 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  close() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
  }
}
