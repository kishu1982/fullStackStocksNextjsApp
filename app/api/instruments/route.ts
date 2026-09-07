import { NextRequest, NextResponse } from "next/server";
import { searchInstruments } from "@/lib/broker/instruments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const symbol = searchParams.get("symbol") || undefined;
    const exchange = searchParams.get("exchange") || undefined;
    const token = searchParams.get("token") || undefined;

    const matchType =
      searchParams.get("matchType") === "includes" ? "includes" : "strict";

    console.log("🔎 API PARAMS:", {
      symbol,
      exchange,
      token,
      matchType,
    });

    const data = await searchInstruments({
      symbol,
      exchange,
      token,
      matchType,
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error("❌ getAllInstruments failed", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to fetch instruments",
      },
      { status: 500 },
    );
  }
}
