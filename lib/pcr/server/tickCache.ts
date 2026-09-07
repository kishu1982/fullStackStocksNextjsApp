import { Tick } from "@/types/instrument";

type Key = string; // `${exch}|${token}`

// Module-level singleton — persists for the life of the Node process (see
// instrumentation.ts). This assumes a single long-running Node server
// (e.g. `next start`), not a multi-instance serverless deployment.
const cache = new Map<Key, Tick>();

export function setTick(exch: string, token: string, tick: Tick): void {
  const key = `${exch}|${token}`;
  cache.set(key, { ...cache.get(key), ...tick });
}

export function getTick(exch: string, token: string): Tick | undefined {
  return cache.get(`${exch}|${token}`);
}

export function tickCacheSize(): number {
  return cache.size;
}
