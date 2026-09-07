import { startPcrScheduler } from "./scheduler";

declare global {
  // eslint-disable-next-line no-var
  var __pcrSchedulerStarted: boolean | undefined;
}

/** Safe to call multiple times (e.g. dev hot-reload) — only starts once per process. */
export function startPcrAutoCapture(): void {
  if (global.__pcrSchedulerStarted) return;
  global.__pcrSchedulerStarted = true;
  startPcrScheduler();
}
