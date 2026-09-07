import fs from "fs-extra";
import path from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";

const DATA_DIR = path.join(process.cwd(), "public", "data", "instrumentInfo");
const OUTPUT_FILE = path.join(DATA_DIR, "instruments.json");

const SYMBOL_URLS = [
  "https://online.moneysukh.com/NFO_symbols.txt.zip",
  "https://online.moneysukh.com/MCX_symbols.txt.zip",
  "https://online.moneysukh.com/CDS_symbols.txt.zip",
  "https://online.moneysukh.com/NSE_symbols_new.txt.zip",
  "https://online.moneysukh.com/BSE_symbols.txt.zip",
  "https://online.moneysukh.com/NSE_Index_symbols.txt.zip",
  "https://online.moneysukh.com/BFO_symbols.txt.zip",
  "https://online.moneysukh.com/BCD_symbols.txt.zip",
];

function normalizeRow(row: any) {
  return {
    exchange: row.Exchange || null,
    token: row.Token ? String(row.Token) : null,
    symbol: row.Symbol || row.IndexName || null,
    tradingSymbol: row.TradingSymbol || null,
    expiry: row.Expiry || null,
    instrument: row.Instrument || null,
    optionType: row.OptionType || null,
    strikePrice: row.StrikePrice ? Number(row.StrikePrice) : null,
    lotSize: row.LotSize ? Number(row.LotSize) : null,
    tickSize: row.TickSize ? Number(row.TickSize) : null,
    precision: row.Precision || null,
    multiplier: row.Multiplier || null,
    indexToken: row.IndexToken || null,
    raw: row,
  };
}

export async function refreshInstrumentData(): Promise<{ count: number }> {
  await fs.ensureDir(DATA_DIR);

  // wipe old file first
  if (await fs.pathExists(OUTPUT_FILE)) {
    await fs.remove(OUTPUT_FILE);
  }

  const allRecords: any[] = [];

  for (const url of SYMBOL_URLS) {
    console.log(`Downloading: ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to download ${url}: ${res.status} ${res.statusText}`,
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    const zip = new AdmZip(Buffer.from(arrayBuffer));

    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      if (!entry.entryName.endsWith(".txt")) continue;

      const csvContent = entry.getData().toString("utf8");

      const records = parse(csvContent, {
        columns: (header: string[]) =>
          header.map((h) => h.trim()).filter((h) => h.length > 0),
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      });

      for (const row of records) {
        allRecords.push(normalizeRow(row));
      }
    }
  }

  await fs.writeJson(OUTPUT_FILE, allRecords, { spaces: 2 });

  console.log(`Saved ${allRecords.length} instruments`);

  return { count: allRecords.length };
}

export async function getAllInstruments(): Promise<any[]> {
  if (!(await fs.pathExists(OUTPUT_FILE))) {
    throw new Error("Instrument data not found. Call refresh API first.");
  }
  return fs.readJson(OUTPUT_FILE);
}

export async function searchInstruments(params: {
  symbol?: string;
  exchange?: string;
  token?: string;
  matchType?: "strict" | "includes";
}) {
  const data = await getAllInstruments();

  const { symbol, exchange, token, matchType = "strict" } = params;

  const searchSymbol = symbol?.trim().toLowerCase();
  const searchExchange = exchange?.trim().toLowerCase();
  const searchToken =
    token !== undefined && token !== null ? String(token).trim() : undefined;

  return data.filter((item) => {
    // -----------------------------------------
    // 1. SYMBOL
    // -----------------------------------------
    if (searchSymbol) {
      const itemSymbol = item.symbol?.trim().toLowerCase() ?? "";

      const itemTradingSymbol = item.tradingSymbol?.trim().toLowerCase() ?? "";

      let symbolMatch = false;

      if (matchType === "strict") {
        // EXACTLY match symbol only
        symbolMatch = itemSymbol === searchSymbol;
      } else {
        // PARTIAL match symbol OR tradingSymbol
        symbolMatch =
          itemSymbol.includes(searchSymbol) ||
          itemTradingSymbol.includes(searchSymbol);
      }

      if (!symbolMatch) {
        return false;
      }
    }

    // -----------------------------------------
    // 2. TOKEN
    // -----------------------------------------
    // Only apply token filtering when token
    // was actually provided.
    if (searchToken !== undefined) {
      const itemToken =
        item.token !== undefined && item.token !== null
          ? String(item.token).trim()
          : "";

      if (itemToken !== searchToken) {
        return false;
      }
    }

    // -----------------------------------------
    // 3. EXCHANGE
    // -----------------------------------------
    if (searchExchange) {
      const itemExchange = item.exchange?.trim().toLowerCase() ?? "";

      if (itemExchange !== searchExchange) {
        return false;
      }
    }

    return true;
  });
}
