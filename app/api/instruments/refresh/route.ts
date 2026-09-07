import { NextResponse } from "next/server";
import { refreshInstrumentData } from "@/lib/broker/instruments";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // increase if your host allows longer serverless timeouts

export async function POST() {
  try {
    const result = await refreshInstrumentData();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("❌ refreshInstrumentData failed", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to refresh instruments",
      },
      { status: 500 },
    );
  }
}
