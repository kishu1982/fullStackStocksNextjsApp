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
import { getPcrSnapshotRepository } from "@/lib/db/data-source";
import { brokerClient } from "@/lib/broker/client";
import { getAnyValidBrokerToken } from "@/lib/broker/tokenStore";

// The underlyings this engine tracks. Add more here if needed later.
export const TRACKED_UNDERLYINGS = [
  { symbol: "NIFTY", exchange: "NFO" },
  // { symbol: "BANKNIFTY", exchange: "NFO" },
  // { symbol: "SENSEX", exchange: "BFO" },
] as const;

const SPOT_TOKENS: Record<string, { exchange: string; token: string }> = {
  NIFTY: {
    exchange: "NSE",
    token: "26000",
  },
  BANKNIFTY: {
    exchange: "NSE",
    token: "26009",
  },
  SENSEX: {
    exchange: "BSE",
    token: "1",
  },
};

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

// Only track expiries within this many days from today (~3 months), as
// requested — this mirrors what the "F&O PCR Data" page effectively does
// by only ever loading one symbol's near-dated contracts at a time.

// const TRACKED_EXPIRY_WINDOW_DAYS = 30;
const TRACKED_MONTHLY_EXPIRIES = 2;

// Strikes to keep on EACH side of the ATM strike, per expiry. This is the
// main lever for staying under the broker's ~3000 subscribed-script cap:
// footprint ≈ Σ over symbols of (expiries-in-window × (2*RADIUS+1) × 2)
// plus a handful of futures per symbol. The old code kept every strike
// across every expiry ever listed (18 expiries × 100+ strikes for NIFTY
// alone) → 9,453 tokens on one connection, which the broker's WS
// self-protected against by dropping the connection in a loop.
const STRIKES_EACH_SIDE = 2000;

// Hard safety ceiling matching the broker's documented WS subscription
// limit. We only ever WARN if we exceed it (rather than silently
// truncating symbols), so it's obvious in the logs if STRIKES_EACH_SIDE
// or TRACKED_EXPIRY_WINDOW_DAYS need to come down further.
const MAX_TOTAL_SUBSCRIPTIONS = 5000;

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

// Expiry strings from the instrument master look like "29-SEP-2026" —
// not sortable/comparable as plain strings across month boundaries.
function parseExpiryDate(expiry: string | null | undefined): number {
  if (!expiry) return Infinity;
  const parts = expiry.split("-");
  if (parts.length !== 3) return Infinity;
  const [dd, mmm, yyyy] = parts;
  const month = MONTHS[mmm.toUpperCase()];
  if (month === undefined) return Infinity;
  return new Date(Number(yyyy), month, Number(dd)).getTime();
}

/** Every not-yet-expired expiry within `days` days from today, soonest first. */
function expiriesWithinWindow(expiries: string[], days: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const cutoffMs = todayMs + days * 24 * 60 * 60 * 1000;

  return Array.from(new Set(expiries))
    .filter((e) => {
      const t = parseExpiryDate(e);
      return t >= todayMs && t <= cutoffMs;
    })
    .sort((a, b) => parseExpiryDate(a) - parseExpiryDate(b));
}

/**
 * Returns monthly FUTIDX contracts only.
 *
 * Monthly index futures are identified by their expiry being the
 * last expiry date available in that calendar month.
 */
function getMonthlyFutures(futures: Instrument[]): Instrument[] {
  const byMonth = new Map<string, Instrument[]>();

  for (const future of futures) {
    if (!future.expiry) continue;

    const expiryMs = parseExpiryDate(future.expiry);
    if (!Number.isFinite(expiryMs)) continue;

    const d = new Date(expiryMs);

    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const list = byMonth.get(monthKey) || [];
    list.push(future);
    byMonth.set(monthKey, list);
  }

  const monthly: Instrument[] = [];

  for (const [, contracts] of byMonth) {
    const latest = contracts.reduce((latest, current) => {
      return parseExpiryDate(current.expiry!) > parseExpiryDate(latest.expiry!)
        ? current
        : latest;
    });

    monthly.push(latest);
  }

  return monthly.sort(
    (a, b) => parseExpiryDate(a.expiry!) - parseExpiryDate(b.expiry!),
  );
}

/** Fetches a live LTP for one instrument via REST, used only to center the strike window. */
async function fetchSpotLTP(
  uid: string,
  accessToken: string,
  instrument: Instrument,
): Promise<number> {
  try {
    const quote = await brokerClient.getQuotes(
      uid,
      instrument.exchange,
      instrument.token,
      accessToken,
    );
    return Number(quote?.lp || 0);
  } catch (err) {
    console.warn(
      `[PCR][spot] Failed to fetch quote for ${instrument.exchange}|${instrument.token}:`,
      (err as any)?.message || err,
    );
    return 0;
  }
}

/** Keeps only the ATM ± N strikes (both CE and PE) for one expiry's options. */
function narrowToAtmWindow(
  options: Instrument[],
  spot: number,
  radius: number,
): Instrument[] {
  const strikes = Array.from(
    new Set(
      options.map((o) => o.strikePrice).filter((s): s is number => s != null),
    ),
  ).sort((a, b) => a - b);

  if (strikes.length === 0) return [];

  // No usable spot reference — fall back to keeping every strike for this
  // expiry rather than risk centering on a wrong price.
  if (!spot) return options;

  let centerIdx = 0;
  let bestDiff = Infinity;
  strikes.forEach((s, idx) => {
    const diff = Math.abs(s - spot);
    if (diff < bestDiff) {
      bestDiff = diff;
      centerIdx = idx;
    }
  });

  const start = Math.max(0, centerIdx - radius);
  const end = Math.min(strikes.length, centerIdx + radius + 1);
  const keepStrikes = new Set(strikes.slice(start, end));

  return options.filter(
    (o) => o.strikePrice != null && keepStrikes.has(o.strikePrice),
  );
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

  // Needed for the REST quote call used to find each symbol's spot price
  // before we decide which strikes to subscribe to.
  const brokerToken = await getAnyValidBrokerToken();

  const next: Record<string, Instrument[]> = {};

  for (const { symbol, exchange } of TRACKED_UNDERLYINGS) {
    const symbolInstruments = all
      .filter(
        (r) => r.exchange === exchange && r.symbol?.toUpperCase() === symbol,
      )
      .map(toInstrument);

    // const allFutures = getFutures(symbolInstruments);
    // const trackedFutures = allFutures.filter(
    //   (f) =>
    //     expiriesWithinWindow([f.expiry || ""], TRACKED_EXPIRY_WINDOW_DAYS)
    //       .length > 0,
    // );

    // const allExpiries = symbolInstruments
    //   .filter((i) => i.instrument === "OPTIDX" && i.expiry)
    //   .map((i) => i.expiry as string);
    // const trackedExpiries = expiriesWithinWindow(
    //   allExpiries,
    //   TRACKED_EXPIRY_WINDOW_DAYS,
    // );
    const allFutures = getFutures(symbolInstruments);

    /*
     * Keep only monthly FUTIDX contracts.
     *
     * This gives us the authoritative monthly expiry dates.
     */
    const monthlyFutures = getMonthlyFutures(allFutures);

    // const trackedFutures = monthlyFutures.filter(
    //   (f) =>
    //     expiriesWithinWindow([f.expiry || ""], TRACKED_EXPIRY_WINDOW_DAYS)
    //       .length > 0,
    // );
    const trackedFutures = monthlyFutures.slice(0, TRACKED_MONTHLY_EXPIRIES);

    /*
     * IMPORTANT:
     *
     * Do NOT collect expiries from all OPTIDX contracts.
     * NIFTY/BANKNIFTY have many weekly option expiries.
     *
     * Instead, take the expiry dates from the monthly FUTIDX
     * contracts and use those dates to select the matching options.
     */
    const trackedExpiries = trackedFutures
      .map((f) => f.expiry)
      .filter((e): e is string => Boolean(e));

    console.log(
      `[PCR][monthly] ${symbol}: monthly futures expiries =`,
      trackedExpiries,
    );

    // Front-month future's LTP is used as a spot proxy to center the ATM
    // strike window for every tracked expiry of this symbol.
    let spot = 0;
    if (brokerToken && allFutures.length > 0) {
      spot = await fetchSpotLTP(
        brokerToken.uid,
        brokerToken.accessToken,
        allFutures[0],
      );
    }
    if (!spot) {
      console.warn(
        `[PCR][spot] ${symbol}: no live quote available yet — keeping full strike range for this load cycle`,
      );
    }

    const narrowedOptions: Instrument[] = [];
    for (const expiry of trackedExpiries) {
      const optionsForExpiry = getOptionsForExpiry(symbolInstruments, expiry);
      narrowedOptions.push(
        ...narrowToAtmWindow(optionsForExpiry, spot, STRIKES_EACH_SIDE),
      );
    }

    next[symbol] = [...trackedFutures, ...narrowedOptions];
  }
  instrumentCache = next;

  // DIAGNOSTIC: confirm the instrument master actually contains rows for
  // every tracked symbol, split by instrument type, and that the total
  // subscription footprint fits under the broker's WS cap.
  let grandTotal = 0;
  for (const { symbol, exchange } of TRACKED_UNDERLYINGS) {
    const list = instrumentCache[symbol] || [];
    const futCount = list.filter((i) => i.instrument === "FUTIDX").length;
    const optCount = list.filter((i) => i.instrument === "OPTIDX").length;
    grandTotal += list.length;
    console.log(
      `[PCR][instruments] ${symbol} (${exchange}): total=${list.length} FUTIDX=${futCount} OPTIDX=${optCount}`,
    );
  }
  console.log(
    `[PCR][instruments] grand total across all symbols: ${grandTotal} (cap: ${MAX_TOTAL_SUBSCRIPTIONS})`,
  );
  if (grandTotal > MAX_TOTAL_SUBSCRIPTIONS) {
    console.warn(
      `[PCR][instruments] ⚠️ ${grandTotal} exceeds the ${MAX_TOTAL_SUBSCRIPTIONS} subscription cap — reduce STRIKES_EACH_SIDE or TRACKED_EXPIRY_WINDOW_DAYS in snapshotEngine.ts`,
    );
  }
}

/** Subscribes the server-side feed to every FUTIDX + OPTIDX token for tracked symbols. */
export function subscribeAllTokens(): void {
  for (const { symbol } of TRACKED_UNDERLYINGS) {
    let count = 0;

    // Subscribe to FUTIDX + OPTIDX
    for (const inst of instrumentCache[symbol] || []) {
      if (inst.instrument === "FUTIDX" || inst.instrument === "OPTIDX") {
        serverBrokerFeed.subscribe(inst.exchange, inst.token);
        count++;
      }
    }

    // Subscribe to SPOT/index token
    const spot = SPOT_TOKENS[symbol];

    if (spot) {
      serverBrokerFeed.subscribe(spot.exchange, spot.token);

      console.log(
        `[PCR][subscribe] ${symbol}: SPOT ${spot.exchange}|${spot.token} queued`,
      );
    }

    console.log(`[PCR][subscribe] ${symbol}: ${count} F&O tokens queued`);
  }
}

// export function subscribeAllTokens(): void {
//   for (const { symbol } of TRACKED_UNDERLYINGS) {
//     let count = 0;
//     for (const inst of instrumentCache[symbol] || []) {
//       if (inst.instrument === "FUTIDX" || inst.instrument === "OPTIDX") {
//         serverBrokerFeed.subscribe(inst.exchange, inst.token);
//         count++;
//       }
//     }
//     console.log(`[PCR][subscribe] ${symbol}: ${count} tokens queued`);
//   }
// }

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

      if (totalCallOI === 0 && totalPutOI === 0) continue; // no OI ticks yet — skip this round

      const { maxPainStrike } = calculateMaxPain(oiPoints);
      // get exact future contract price
      // const underlyingFuture = pickUnderlyingFuture(futures, expiry);
      // const futuresLTP = underlyingFuture
      //   ? Number(
      //       getTick(underlyingFuture.exchange, underlyingFuture.token)?.lp || 0,
      //     )
      //   : 0;

      // get spot price for underlying future contract
      const spot = SPOT_TOKENS[symbol];

      const futuresLTP = spot
        ? Number(getTick(spot.exchange, spot.token)?.lp || 0)
        : 0;

      const calculatedPCR = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

      console.log(
        `[PCR][CALC] ${symbol} ${expiry} | ` +
          `Call OI=${totalCallOI} | ` +
          `Put OI=${totalPutOI} | ` +
          `PCR=${calculatedPCR} | ` +
          `PCR(5)=${calculatedPCR.toFixed(5)}`,
      );

      const doc = repo.create({
        symbol,
        exchange,
        expiry,
        timestamp: now,
        dateKeyIST: dateKey,
        // pcr:
        //   totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(5)) : 0,
        pcr: Number(calculatedPCR.toFixed(4)),
        totalCallOI,
        totalPutOI,
        maxPainStrike,
        // TEMPORARILY KEEP EXISTING DB FIELD NAME.
        // Value is now SPOT LTP.
        futuresLTP,

        // TEMPORARILY KEEP EXISTING DB FIELD NAME.
        // Value is now SPOT token.
        futuresToken: spot?.token || "",

        // No futures expiry because we are storing SPOT.
        futuresExpiryUsed: undefined,
      });
      console.log(
        `[PCR][SPOT] ${symbol}: token=${spot?.token} LTP=${futuresLTP}`,
      );

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
  const repo = await getPcrSnapshotRepository();

  const keep: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    keep.push(istDateKey(d));
  }

  await repo.deleteMany({ dateKeyIST: { $nin: keep } } as any);
}
