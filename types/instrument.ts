export interface Instrument {
  exchange: string;
  token: string;
  symbol: string;
  tradingSymbol: string;
  expiry: string | null;
  instrument: string; // FUTIDX, OPTIDX, FUTSTK, OPTSTK...
  optionType: "CE" | "PE" | null;
  strikePrice: number | null;
  lotSize: number | null;
  tickSize: number | null;
}

export interface Tick {
  e?: string;
  tk?: string;
  lp?: string | number; // last price
  pc?: string | number; // % change
  oi?: string | number;
  v?: string | number;
  [key: string]: any;
}
