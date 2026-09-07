export interface OIPoint {
  strike: number;
  ceOI: number;
  peOI: number;
}

export interface MaxPainResult {
  maxPainStrike: number;
  payoutTable: { strike: number; payout: number }[];
}

/**
 * Standard max-pain algorithm: for every candidate settlement price (each
 * listed strike), sum what option writers would have to pay out across ALL
 * strikes if the market settled there. The strike with the LOWEST total
 * payout is "max pain" — the price at which option buyers collectively lose
 * the most (and writers lose the least).
 */
export function calculateMaxPain(points: OIPoint[]): MaxPainResult {
  if (points.length === 0) return { maxPainStrike: 0, payoutTable: [] };

  const payoutTable = points.map(({ strike: settle }) => {
    let payout = 0;
    for (const p of points) {
      if (settle > p.strike) payout += (settle - p.strike) * p.ceOI; // CE in-the-money
      if (settle < p.strike) payout += (p.strike - settle) * p.peOI; // PE in-the-money
    }
    return { strike: settle, payout };
  });

  const minEntry = payoutTable.reduce(
    (min, cur) => (cur.payout < min.payout ? cur : min),
    payoutTable[0],
  );

  return { maxPainStrike: minEntry.strike, payoutTable };
}
