import { NextRequest, NextResponse } from "next/server";
import { brokerConfig } from "@/lib/broker/config";

export async function POST(req: NextRequest) {
  const { uid, jKey, exch, symbol } = await req.json();

  if (!uid || !jKey || !exch || !symbol) {
    return NextResponse.json(
      { error: "Missing required fields: uid, jKey, exch, symbol" },
      { status: 400 },
    );
  }

  const jData = JSON.stringify({
    uid,
    stext: symbol.toUpperCase(),
    exch: exch.toUpperCase(),
  });
  const bodyString = `jData=${jData}&jKey=${jKey}`; // raw, unencoded — Noren API quirk

  const res = await fetch(`${brokerConfig.baseUrl}/SearchScrip`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyString,
  });

  const rawText = await res.text();

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { error: "Broker returned non-JSON: " + rawText.slice(0, 200) },
      { status: 502 },
    );
  }

  if (data.stat === "Not_Ok") {
    return NextResponse.json(
      { error: data.emsg || "SearchScrip failed" },
      { status: 502 },
    );
  }

  const allResults = data.values || [];
  //   console.log("scripts found for", symbol, ":", allResults);
  //   console.log("scripts length found for", symbol, ":", allResults.length);

  // Strict exact match on symname only — excludes lookalikes like NIFTYFPI, NIFTYNXT50
  // that SearchScrip's fuzzy stext matching would otherwise pull in.
  const matched = allResults.filter(
    (v: any) => v.symname?.toUpperCase() === symbol.toUpperCase(),
  );

  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    exch: exch.toUpperCase(),
    count: matched.length,
    values: matched,
  });
}
