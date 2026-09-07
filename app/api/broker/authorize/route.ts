// kicks off login; this is the "user enters password + OTP" step, done on the broker's page:

import { NextResponse } from "next/server";
import { brokerConfig } from "@/lib/broker/config";

// auth url reff : https://online.moneysukh.com/OAuthlogin/authorize/oauth?client_id==YOUR_CLIENT_ID
export async function GET() {
  const baseUrl = brokerConfig.authUrl;
  const clientId = brokerConfig.clientId;
  // Safeguard: Check if the base URL or client ID is missing
  console.log("Broker auth URL:", baseUrl);
  console.log("Broker client ID:", clientId);

  if (!baseUrl || baseUrl === "undefined") {
    return NextResponse.json(
      { error: "Broker auth URL configuration is missing" },
      { status: 500 },
    );
  }

  try {
    // Safely construct the absolute URL using the native URL Web API
    const authUrl = new URL(baseUrl);
    authUrl.searchParams.set("client_id", clientId || "");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid absolute URL structure provided in config" },
      { status: 500 },
    );
  }
}
