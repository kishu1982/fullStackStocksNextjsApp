import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
// import { getDataSource } from "@/lib/db/data-source";
// import { PcrSnapshot } from "@/lib/db/entities/PcrSnapshot.entity";
import { getPcrSnapshotRepository } from "@/lib/db/data-source";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // const ds = await getDataSource();
    // const repo = ds.getMongoRepository(PcrSnapshot);
    const repo = await getPcrSnapshotRepository();
    const row = await repo.findOneBy({ _id: new ObjectId(id) } as any);
    if (!row)
      return NextResponse.json(
        { success: false, message: "Not found" },
        { status: 404 },
      );
    return NextResponse.json({ success: true, data: row });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json();
    // const ds = await getDataSource();
    // const repo = ds.getMongoRepository(PcrSnapshot);
    const repo = await getPcrSnapshotRepository();
    await repo.updateOne({ _id: new ObjectId(id) } as any, { $set: body });
    const row = await repo.findOneBy({ _id: new ObjectId(id) } as any);
    return NextResponse.json({ success: true, data: row });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    // const ds = await getDataSource();
    // const repo = ds.getMongoRepository(PcrSnapshot);
    const repo = await getPcrSnapshotRepository();
    const result = await repo.deleteOne({ _id: new ObjectId(id) } as any);
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
