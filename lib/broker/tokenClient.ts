// lib/broker/tokenClient.ts
const STORAGE_KEY = "broker_session";

export interface BrokerSession {
  uid: string;
  accessToken: string;
  expiresAt: number; // kept for reference/logging only, not used to gate expiry anymore
  issuedDateIST: string; // "YYYY-MM-DD" in IST — this is the real daily cutoff
}

function getISTDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function saveSession(session: {
  uid: string;
  accessToken: string;
  expiresAt: number;
}) {
  const full: BrokerSession = { ...session, issuedDateIST: getISTDateKey() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
}

export function getSession(): BrokerSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const session: BrokerSession = JSON.parse(raw);
  const expiredByISTDay = session.issuedDateIST !== getISTDateKey(); // sole source of truth now

  if (expiredByISTDay) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return session;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}
