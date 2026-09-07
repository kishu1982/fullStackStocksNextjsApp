/** Is `d` currently inside 09:00–16:00 IST? */
export function isWithinCaptureWindow(d: Date = new Date()): boolean {
  const ist = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d); // "HH:mm"
  const [h, m] = ist.split(":").map(Number);
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 && minutes <= 16 * 60;
}

/** IST calendar-day key, e.g. "2026-09-07" — used for the 3-day retention rule. */
export function istDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    d,
  );
}
