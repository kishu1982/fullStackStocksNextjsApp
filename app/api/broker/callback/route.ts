//broker redirects here with ?code=...; exchange it for the access token and hand it to the browser once via redirect query params so the client can cache it:

import { NextRequest, NextResponse } from "next/server";
import { brokerConfig } from "@/lib/broker/config";
import { generateChecksum } from "@/lib/broker/checksum";
import { saveBrokerToken } from "@/lib/broker/tokenStore";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", req.url));
  }

  const checksum = generateChecksum(code);
  const jDataString = JSON.stringify({ code, checksum });
  const bodyString = `jData=${jDataString}`; // raw, NOT url-encoded — Noren API quirk

  const res = await fetch(`${brokerConfig.baseUrl}/GenAcsTok`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyString,
  });

  const rawText = await res.text();
  console.log("GenAcsTok status:", res.status);
  console.log("GenAcsTok raw body:", rawText);

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Broker returned non-JSON: " + rawText.slice(0, 100))}`,
        req.url,
      ),
    );
  }

  if (data.stat !== "Ok") {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(data.emsg || "auth_failed")}`,
        req.url,
      ),
    );
  }

  const rawExpiry = Number(data.expires_in);
  const expiresAt =
    rawExpiry > 1_000_000_000
      ? rawExpiry
      : Math.floor(Date.now() / 1000) + rawExpiry;

  await saveBrokerToken({
    uid: data.uid,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  });

  const redirectUrl = new URL("/dashboard", req.url);
  redirectUrl.searchParams.set("uid", data.uid);
  redirectUrl.searchParams.set("token", data.access_token);
  redirectUrl.searchParams.set("expiresAt", String(expiresAt));
  return NextResponse.redirect(redirectUrl);
}
