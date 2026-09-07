//singleton pattern so hot-reload / serverless invocations don't open a new connection every call:

import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User.entity";
import { BrokerToken } from "./entities/BrokerToken.entity";
import { PcrSnapshot } from "./entities/PcrSnapshot.entity";

declare global {
  // eslint-disable-next-line no-var
  var __typeormDataSource: DataSource | undefined;
}

function createDataSource(): DataSource {
  return new DataSource({
    type: "mongodb",
    url: process.env.MONGODB_URI,
    database: process.env.MONGODB_DB,
    synchronize: true, // fine for dev; switch off + use migrations in prod
    entities: [User, BrokerToken, PcrSnapshot],
  });
}

export async function getDataSource(): Promise<DataSource> {
  let ds = global.__typeormDataSource;

  // If cached DataSource is missing entity metadata for current PcrSnapshot class reference (e.g. from HMR), destroy and reset:
  if (ds && !ds.hasMetadata(PcrSnapshot)) {
    console.warn("⚠️ Stale DataSource singleton detected missing PcrSnapshot class metadata. Re-initializing connection...");
    if (ds.isInitialized) {
      try {
        await ds.destroy();
      } catch (err) {
        console.error("Error destroying stale DataSource:", err);
      }
    }
    ds = undefined;
    global.__typeormDataSource = undefined;
  }

  if (!ds) {
    ds = createDataSource();
    if (process.env.NODE_ENV !== "production") {
      global.__typeormDataSource = ds;
    }
  }

  if (!ds.isInitialized) {
    await ds.initialize();

    try {
      const tokenRepo = ds.getMongoRepository(BrokerToken);
      await tokenRepo.createCollectionIndex(
        { expiresAtDate: 1 },
        { expireAfterSeconds: 0 },
      );

      const pcrRepo = ds.getMongoRepository(PcrSnapshot);
      await pcrRepo.createCollectionIndex({ symbol: 1, expiry: 1, timestamp: 1 });
      await pcrRepo.createCollectionIndex({ dateKeyIST: 1 });
    } catch (err: any) {
      // Non-fatal warning if indexes already exist from TypeORM entity decorators
      console.warn("MongoDB collection index note:", err.message || err);
    }
  }

  return ds;
}

// export async function getDataSource() {
//   if (!AppDataSource.isInitialized) {
//     await AppDataSource.initialize();

//     const repo = AppDataSource.getMongoRepository(BrokerToken);
//     await repo.createCollectionIndex(
//       { expiresAtDate: 1 },
//       { expireAfterSeconds: 0 }, // Mongo deletes the doc automatically once expiresAtDate passes
//     );
//   }
//   return AppDataSource;
// }
