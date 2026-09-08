import { NextRequest, NextResponse } from "next/server";
// import { getDataSource } from "@/lib/db/data-source";
// import { PcrSnapshot } from "@/lib/db/entities/PcrSnapshot.entity";
import { getPcrSnapshotRepository } from "@/lib/db/data-source";

export const dynamic = "force-dynamic";

// GET /api/pcr?symbol=NIFTY&expiry=15-SEP-2026&limit=300&since=<ISO>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const expiry = searchParams.get("expiry");
    const since = searchParams.get("since");
    const limit = Number(searchParams.get("limit") || 5000);

    if (!symbol) {
      return NextResponse.json(
        { success: false, message: "symbol is required" },
        { status: 400 },
      );
    }

    // const ds = await getDataSource();
    // const repo = ds.getMongoRepository(PcrSnapshot);
    const repo = await getPcrSnapshotRepository();

    const where: Record<string, any> = { symbol: symbol.toUpperCase() };
    if (expiry) where.expiry = expiry;
    if (since) where.timestamp = { $gt: new Date(since) };

    // const rows = await repo.find({
    //   where,
    //   order: { timestamp: "ASC" } as any,
    //   take: limit,
    // } as any);

    // to get latest data not older

    const rows = await repo.find({
      where,
      order: { timestamp: "DESC" } as any,
      take: limit,
    } as any);

    rows.reverse();

    return NextResponse.json({ success: true, count: rows.length, data: rows });
  } catch (error: any) {
    console.error("❌ GET /api/pcr failed", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}

// POST /api/pcr — manual insert (mainly for testing; the engine writes directly to the DB)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // const ds = await getDataSource();
    // const repo = ds.getMongoRepository(PcrSnapshot);
    const repo = await getPcrSnapshotRepository();
    const doc = repo.create(body);
    const saved = await repo.save(doc);
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    console.error("❌ POST /api/pcr failed", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}

// DELETE /api/pcr?symbol=NIFTY&expiry=15-SEP-2026 (expiry optional — omit to wipe the whole symbol)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const expiry = searchParams.get("expiry");

    if (!symbol) {
      return NextResponse.json(
        { success: false, message: "symbol is required" },
        { status: 400 },
      );
    }

    // const ds = await getDataSource();
    // const repo = ds.getMongoRepository(PcrSnapshot);
    const repo = await getPcrSnapshotRepository();
    const where: Record<string, any> = { symbol: symbol.toUpperCase() };
    if (expiry) where.expiry = expiry;

    const result = await repo.deleteMany(where as any);
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error("❌ DELETE /api/pcr failed", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
