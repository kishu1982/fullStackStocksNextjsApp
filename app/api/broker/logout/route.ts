import { NextResponse } from "next/server";
import { clearBrokerToken } from "@/lib/broker/tokenStore";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearBrokerToken();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("POST /api/broker/logout failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to logout",
      },
      { status: 500 },
    );
  }
}
