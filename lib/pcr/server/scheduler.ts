import { isWithinCaptureWindow } from "./marketHours";
import { serverBrokerFeed } from "./brokerFeedServer";
import { getAnyValidBrokerToken } from "@/lib/broker/tokenStore";
import {
  loadTrackedInstruments,
  subscribeAllTokens,
  computeAndStoreSnapshots,
  cleanupOldSnapshots,
} from "./snapshotEngine";

const CAPTURE_INTERVAL_MS = 10_000; // matches the 10s polling on the PCR Details page
const CLEANUP_INTERVAL_MS = 30 * 60_000;
const WINDOW_CHECK_INTERVAL_MS = 60_000;

let captureTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function startCapture() {
  if (running) return;

  const token = await getAnyValidBrokerToken();
  if (!token) {
    console.warn(
      "PCR auto-capture: no valid broker token in DB yet — log in once, it'll pick it up on the next check.",
    );
    return;
  }

  await loadTrackedInstruments();
  serverBrokerFeed.start(token.uid, token.accessToken);
  subscribeAllTokens();
  running = true;

  captureTimer = setInterval(() => {
    computeAndStoreSnapshots().catch((e) =>
      console.error("PCR snapshot error", e),
    );
  }, CAPTURE_INTERVAL_MS);

  console.log("✅ PCR auto-capture started");
}

function stopCapture() {
  if (!running) return;
  if (captureTimer) clearInterval(captureTimer);
  serverBrokerFeed.stop();
  running = false;
  console.log("🛑 PCR auto-capture stopped (outside 9:00–16:00 IST)");
}

export function startPcrScheduler() {
  // Check every minute whether we should be capturing right now.
  setInterval(() => {
    if (isWithinCaptureWindow()) startCapture().catch(console.error);
    else stopCapture();
  }, WINDOW_CHECK_INTERVAL_MS);

  // Also check immediately at boot (server may start mid-session).
  if (isWithinCaptureWindow()) startCapture().catch(console.error);

  // Retention cleanup — independent of market hours.
  setInterval(() => {
    cleanupOldSnapshots().catch((e) => console.error("PCR cleanup error", e));
  }, CLEANUP_INTERVAL_MS);
  cleanupOldSnapshots().catch(console.error);
}
