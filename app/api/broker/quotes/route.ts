//example route using it:

import { NextRequest, NextResponse } from "next/server";
import { brokerClient } from "@/lib/broker/client";

export async function POST(req: NextRequest) {
  const { uid, exch, token, jKey } = await req.json();
  if (!uid || !exch || !token || !jKey) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const data = await brokerClient.getQuotes(uid, exch, token, jKey);
  return NextResponse.json(data);
}
