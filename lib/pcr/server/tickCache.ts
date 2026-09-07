import { Tick } from "@/types/instrument";

type Key = string; // `${exch}|${token}`

// Module-level singleton — persists for the life of the Node process (see
// instrumentation.ts). This assumes a single long-running Node server
// (e.g. `next start`), not a multi-instance serverless deployment.
const cache = new Map<Key, Tick>();
const tokenCache = new Map<string, Tick>();

export function setTick(exch: string, token: string, tick: Tick): void {
  if (!token) return;
  const tkStr = String(token);
  const key = `${exch}|${tkStr}`;
  cache.set(key, { ...cache.get(key), ...tick });
  tokenCache.set(tkStr, { ...tokenCache.get(tkStr), ...tick });
}

export function getTick(exch: string, token: string): Tick | undefined {
  if (!token) return undefined;
  const tkStr = String(token);
  return cache.get(`${exch}|${tkStr}`) ?? tokenCache.get(tkStr);
}

export function tickCacheSize(): number {
  return cache.size;
}
