import { NextRequest, NextResponse } from "next/server";
import { brokerConfig } from "@/lib/broker/config";

export async function POST(req: NextRequest) {
  const { uid, jKey } = await req.json();

  const jData = JSON.stringify({ uid, stext: "NIFTY", exch: "NFO" });
  const bodyString = `jData=${jData}&jKey=${jKey}`; // raw, unencoded — Noren API quirk

  const res = await fetch(`${brokerConfig.baseUrl}/SearchScrip`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyString,
  });

  const rawText = await res.text();
  console.log("SearchScrip status:", res.status);
  // console.log("SearchScrip raw body:", rawText);

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

  const futures = (data.values || []).filter(
    (v: any) => v.instname === "FUTIDX" && v.symname === "NIFTY",
  );

  // exd is like "29-SEP-2026" — parse and sort chronologically, nearest first
  futures.sort(
    (a: any, b: any) => new Date(a.exd).getTime() - new Date(b.exd).getTime(),
  );

  return NextResponse.json({ nearest: futures[0] ?? null, all: futures });
}
