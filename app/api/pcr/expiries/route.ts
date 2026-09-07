import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { PcrSnapshot } from "@/lib/db/entities/PcrSnapshot.entity";

export const dynamic = "force-dynamic";

// GET /api/pcr/expiries?symbol=NIFTY
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    if (!symbol) {
      return NextResponse.json(
        { success: false, message: "symbol is required" },
        { status: 400 },
      );
    }

    const ds = await getDataSource();
    const repo = ds.getMongoRepository(PcrSnapshot);
    const expiries: string[] = await repo.distinct("expiry", {
      symbol: symbol.toUpperCase(),
    } as any);
    expiries.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return NextResponse.json({ success: true, data: expiries });
  } catch (error: any) {
    console.error("❌ GET /api/pcr/expiries failed", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
