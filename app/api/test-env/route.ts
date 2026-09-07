import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    BROKER_CLIENT_ID: process.env.BROKER_CLIENT_ID,
    BROKER_ACC_ID: process.env.BROKER_ACC_ID,

    NEXT_PUBLIC_BROKER_CLIENT_ID: process.env.NEXT_PUBLIC_BROKER_CLIENT_ID,

    NEXT_PUBLIC_BROKER_ACC_ID: process.env.NEXT_PUBLIC_BROKER_ACC_ID,

    NODE_ENV: process.env.NODE_ENV,
  });
}
