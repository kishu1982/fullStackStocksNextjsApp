import { Instrument } from "@/types/instrument";
import {
  getAllInstruments,
  refreshInstrumentData,
} from "@/lib/broker/instruments";
import {
  getFutures,
  getOptionsForExpiry,
  groupByStrike,
} from "@/lib/pcr/groupInstruments";
import { calculateMaxPain } from "@/lib/pcr/maxPain";
import { serverBrokerFeed } from "./brokerFeedServer";
import { getTick } from "./tickCache";
import { istDateKey } from "./marketHours";
// import { getDataSource } from "@/lib/db/data-source";
// import type { PcrSnapshot } from "@/lib/db/entities/PcrSnapshot.entity";
import { getPcrSnapshotRepository } from "@/lib/db/data-source";

// The underlyings this engine tracks. Add more here if needed later.
export const TRACKED_UNDERLYINGS = [
  { symbol: "NIFTY", exchange: "NFO" },
  { symbol: "BANKNIFTY", exchange: "NFO" },
  { symbol: "SENSEX", exchange: "BFO" },
] as const;

let instrumentCache: Record<string, Instrument[]> = {};
let lastLoadedDateKey: string | null = null;

function toInstrument(row: any): Instrument {
  return {
    exchange: row.exchange,
    token: row.token,
    symbol: row.symbol,
    tradingSymbol: row.tradingSymbol,
    expiry: row.expiry,
    instrument: row.instrument,
    optionType: row.optionType,
    strikePrice: row.strikePrice,
    lotSize: row.lotSize,
    tickSize: row.tickSize,
  };
}

/** Loads (and daily-refreshes) the FUTIDX/OPTIDX instrument list for every tracked symbol. */
export async function loadTrackedInstruments(): Promise<void> {
  const today = istDateKey();

  let all: any[];
  try {
    all = await getAllInstruments();
  } catch {
    await refreshInstrumentData();
    all = await getAllInstruments();
  }

  // Re-download once per IST calendar day so expired weekly contracts roll off.
  if (lastLoadedDateKey !== today) {
    await refreshInstrumentData();
    all = await getAllInstruments();
    lastLoadedDateKey = today;
  }

  const next: Record<string, Instrument[]> = {};
  for (const { symbol, exchange } of TRACKED_UNDERLYINGS) {
    next[symbol] = all
      .filter(
        (r) => r.exchange === exchange && r.symbol?.toUpperCase() === symbol,
      )
      .map(toInstrument);
  }
  instrumentCache = next;

  // DIAGNOSTIC: confirm the instrument master actually contains rows for
  // every tracked symbol, split by instrument type.
  for (const { symbol, exchange } of TRACKED_UNDERLYINGS) {
    const list = instrumentCache[symbol] || [];
    const futCount = list.filter((i) => i.instrument === "FUTIDX").length;
    const optCount = list.filter((i) => i.instrument === "OPTIDX").length;
    console.log(
      `[PCR][instruments] ${symbol} (${exchange}): total=${list.length} FUTIDX=${futCount} OPTIDX=${optCount}`,
    );
  }
}

/** Subscribes the server-side feed to every FUTIDX + OPTIDX token for tracked symbols. */
// export function subscribeAllTokens(): void {
//   for (const { symbol } of TRACKED_UNDERLYINGS) {
//     for (const inst of instrumentCache[symbol] || []) {
//       if (inst.instrument === "FUTIDX" || inst.instrument === "OPTIDX") {
//         serverBrokerFeed.subscribe(inst.exchange, inst.token);
//       }
//     }
//   }
// }
export function subscribeAllTokens(): void {
  for (const { symbol } of TRACKED_UNDERLYINGS) {
    let count = 0;
    for (const inst of instrumentCache[symbol] || []) {
      if (inst.instrument === "FUTIDX" || inst.instrument === "OPTIDX") {
        serverBrokerFeed.subscribe(inst.exchange, inst.token);
        count++;
      }
    }
    console.log(`[PCR][subscribe] ${symbol}: ${count} tokens queued`);
  }
}

// NIFTY/BANKNIFTY have weekly option expiries but only monthly futures — fall
// back to the nearest (front-month) future when there's no exact match.
function pickUnderlyingFuture(futures: Instrument[], expiry: string | null) {
  if (futures.length === 0) return null;
  return futures.find((f) => f.expiry === expiry) ?? futures[0];
}

/** Computes PCR / Max Pain / futures LTP for every tracked (symbol, expiry) and stores a row. */
export async function computeAndStoreSnapshots(): Promise<void> {
  const repo = await getPcrSnapshotRepository();
  const now = new Date();
  const dateKey = istDateKey(now);

  for (const { symbol, exchange } of TRACKED_UNDERLYINGS) {
    const instruments = instrumentCache[symbol] || [];
    if (instruments.length === 0) {
      console.log(`[PCR][skip] ${symbol}: instrumentCache is empty`);
      continue;
    }

    const futures = getFutures(instruments);
    const expiries = Array.from(
      new Set(
        instruments
          .filter((i) => i.instrument === "OPTIDX" && i.expiry)
          .map((i) => i.expiry as string),
      ),
    );

    if (expiries.length === 0) {
      console.log(
        `[PCR][skip] ${symbol}: 0 OPTIDX expiries found (${instruments.length} instruments loaded, ${futures.length} futures)`,
      );
      continue;
    }

    let savedCount = 0;

    for (const expiry of expiries) {
      const options = getOptionsForExpiry(instruments, expiry);
      if (options.length === 0) continue;

      const strikeRows = groupByStrike(options);

      let totalCallOI = 0;
      let totalPutOI = 0;
      const oiPoints = strikeRows.map((row) => {
        const ceOI = row.ce
          ? Number(getTick(exchange, row.ce.token)?.oi || 0)
          : 0;
        const peOI = row.pe
          ? Number(getTick(exchange, row.pe.token)?.oi || 0)
          : 0;
        totalCallOI += ceOI;
        totalPutOI += peOI;
        return { strike: row.strikePrice, ceOI, peOI };
      });

      if (totalCallOI === 0 && totalPutOI === 0) continue;

      const { maxPainStrike } = calculateMaxPain(oiPoints);
      const underlyingFuture = pickUnderlyingFuture(futures, expiry);
      const futuresLTP = underlyingFuture
        ? Number(
            getTick(underlyingFuture.exchange, underlyingFuture.token)?.lp || 0,
          )
        : 0;

      const doc = repo.create({
        symbol,
        exchange,
        expiry,
        timestamp: now,
        dateKeyIST: dateKey,
        pcr:
          totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(3)) : 0,
        totalCallOI,
        totalPutOI,
        maxPainStrike,
        futuresLTP,
        futuresToken: underlyingFuture?.token || "",
        futuresExpiryUsed: underlyingFuture?.expiry || undefined,
      });

      await repo.save(doc);
      savedCount++;
    }

    console.log(
      `[PCR][cycle] ${symbol}: ${expiries.length} expiries checked, ${savedCount} rows saved`,
    );
  }
}

/** Keeps only today + the previous 2 IST calendar days (3 days total). */
export async function cleanupOldSnapshots(): Promise<void> {
  // const ds = await getDataSource();
  // const repo = ds.getMongoRepository<PcrSnapshot>("PcrSnapshot");
  const repo = await getPcrSnapshotRepository();

  const keep: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    keep.push(istDateKey(d));
  }

  await repo.deleteMany({ dateKeyIST: { $nin: keep } } as any);
}
