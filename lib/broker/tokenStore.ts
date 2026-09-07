import { getDataSource } from "../db/data-source";
import { BrokerToken } from "../db/entities/BrokerToken.entity";

// UTC equivalent of "midnight IST tonight/tomorrow" — IST is UTC+5:30,
// so IST midnight = 18:30 UTC on the same UTC calendar day.
function nextISTMidnightUTC(from: Date = new Date()): Date {
  const istDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(from);
  const [y, m, d] = istDateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 18, 30, 0));
}

export async function saveBrokerToken(params: {
  uid: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}) {
  const ds = await getDataSource();
  const repo = ds.getMongoRepository(BrokerToken);

  // Whichever comes first: the broker's own ceiling, or the next IST midnight.
  const brokerCeilingMs = params.expiresAt * 1000;
  const istCutoffMs = nextISTMidnightUTC().getTime();
  const expiresAtDate = new Date(Math.min(brokerCeilingMs, istCutoffMs));

  const existing = await repo.findOneBy({ uid: params.uid });
  if (existing) {
    existing.accessToken = params.accessToken;
    existing.refreshToken = params.refreshToken;
    existing.expiresAt = params.expiresAt;
    existing.expiresAtDate = expiresAtDate;
    return repo.save(existing);
  }
  return repo.save(repo.create({ ...params, expiresAtDate }));
}

export async function getBrokerToken(uid: string) {
  const ds = await getDataSource();
  return ds.getMongoRepository(BrokerToken).findOneBy({ uid });
}

export async function isTokenValid(uid: string): Promise<boolean> {
  const token = await getBrokerToken(uid);
  if (!token) return false;
  return token.expiresAtDate.getTime() > Date.now();
}

// getting token for pcr price feed and broker api
export async function getAnyValidBrokerToken() {
  const ds = await getDataSource();
  const repo = ds.getMongoRepository(BrokerToken);
  const tokens = await repo.find();
  const valid = tokens.filter((t) => t.expiresAtDate.getTime() > Date.now());
  valid.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return valid[0] ?? null;
}
