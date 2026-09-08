import { getDataSource } from "../db/data-source";
import type { BrokerToken } from "../db/entities/BrokerToken.entity";
import { MongoRepository } from "typeorm";

// UTC equivalent of "midnight IST tonight/tomorrow" — IST is UTC+5:30,
// so IST midnight = 18:30 UTC on the same UTC calendar day.
function nextISTMidnightUTC(from: Date = new Date()): Date {
  const istDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(from);
  const [y, m, d] = istDateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 18, 30, 0));
}

/**
 * Get the BrokerToken repo using the *same* class reference that was
 * registered with the DataSource — avoids Turbopack module-duplication
 * where a re-imported class is a different JS object identity.
 */
async function getBrokerTokenRepo(): Promise<MongoRepository<BrokerToken>> {
  const ds = await getDataSource();
  // Use the entity name string so TypeORM looks up by registered name,
  // not by class reference identity (which can differ across Turbopack chunks).
  return ds.getMongoRepository<BrokerToken>("BrokerToken");
}

export async function saveBrokerToken(params: {
  uid: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}) {
  const repo = await getBrokerTokenRepo();

  // Whichever comes first:
  // broker expiry or next IST midnight.
  const brokerCeilingMs = params.expiresAt * 1000;
  const istCutoffMs = nextISTMidnightUTC().getTime();

  const expiresAtDate = new Date(Math.min(brokerCeilingMs, istCutoffMs));

  console.log("💾 Saving broker token:", {
    uid: params.uid,
    expiresAt: params.expiresAt,
    expiresAtDate,
  });

  const existing = await repo.findOneBy({
    uid: params.uid,
  });

  if (existing) {
    console.log("♻️ Updating existing broker token:", {
      uid: params.uid,
      id: existing.id,
    });

    existing.accessToken = params.accessToken;
    existing.refreshToken = params.refreshToken;
    existing.expiresAt = params.expiresAt;
    existing.expiresAtDate = expiresAtDate;

    const saved = await repo.save(existing);

    console.log("✅ Broker token updated:", {
      uid: saved.uid,
      id: saved.id,
    });

    return saved;
  }

  console.log("🆕 Creating new broker token:", {
    uid: params.uid,
  });

  const token = repo.create({
    uid: params.uid,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    expiresAt: params.expiresAt,
    expiresAtDate,
  });

  const saved = await repo.save(token);

  console.log("✅ Broker token created:", {
    uid: saved.uid,
    id: saved.id,
  });

  return saved;
}

export async function getBrokerToken(uid: string) {
  const repo = await getBrokerTokenRepo();
  return repo.findOneBy({ uid });
}

export async function isTokenValid(uid: string): Promise<boolean> {
  const token = await getBrokerToken(uid);
  if (!token) return false;
  return token.expiresAtDate.getTime() > Date.now();
}

// getting token for pcr price feed and broker api
export async function getAnyValidBrokerToken() {
  const repo = await getBrokerTokenRepo();
  const tokens = await repo.find();
  const valid = tokens.filter((t) => t.expiresAtDate.getTime() > Date.now());
  valid.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return valid[0] ?? null;
}

