import { Instrument } from "@/types/instrument";

export function getFutures(instruments: Instrument[]): Instrument[] {
  return instruments
    .filter((i) => i.instrument === "FUTIDX")
    .sort((a, b) => (a.expiry || "").localeCompare(b.expiry || ""));
}

export function getOptionsForExpiry(
  instruments: Instrument[],
  expiry: string | null,
): Instrument[] {
  if (!expiry) return [];
  return instruments.filter(
    (i) => i.instrument === "OPTIDX" && i.expiry === expiry,
  );
}

export interface StrikeRow {
  strikePrice: number;
  ce: Instrument | null;
  pe: Instrument | null;
}

export function groupByStrike(options: Instrument[]): StrikeRow[] {
  const map = new Map<number, StrikeRow>();

  for (const opt of options) {
    if (opt.strikePrice == null) continue;
    if (!map.has(opt.strikePrice)) {
      map.set(opt.strikePrice, {
        strikePrice: opt.strikePrice,
        ce: null,
        pe: null,
      });
    }
    const row = map.get(opt.strikePrice)!;
    if (opt.optionType === "CE") row.ce = opt;
    if (opt.optionType === "PE") row.pe = opt;
  }

  return Array.from(map.values()).sort((a, b) => a.strikePrice - b.strikePrice);
}
