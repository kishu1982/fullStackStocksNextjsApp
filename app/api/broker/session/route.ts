import { NextResponse } from "next/server";
import { getAnyValidBrokerToken } from "@/lib/broker/tokenStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await getAnyValidBrokerToken();

    if (!token) {
      console.log("❌ No valid broker token found");

      return NextResponse.json(
        {
          authenticated: false,
        },
        {
          status: 401,
        },
      );
    }

    console.log("✅ Valid broker token found:", {
      uid: token.uid,
      expiresAt: token.expiresAt,
      expiresAtDate: token.expiresAtDate,
    });

    return NextResponse.json({
      authenticated: true,
      session: {
        uid: token.uid,
        accessToken: token.accessToken,
        expiresAt: token.expiresAt,
      },
    });
  } catch (error) {
    console.error("❌ GET /api/broker/session failed:", error);

    return NextResponse.json(
      {
        authenticated: false,
        error: "Failed to validate broker session",
      },
      {
        status: 500,
      },
    );
  }
}
