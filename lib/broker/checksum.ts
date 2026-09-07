//order matters: ClientID + SecretKey + code, SHA256, no spaces.

import crypto from "crypto";
import { brokerConfig } from "./config";

export function generateChecksum(authCode: string): string {
  const raw = `${brokerConfig.clientId}${brokerConfig.secretKey}${authCode}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}
