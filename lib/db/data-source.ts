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

const AppDataSource =
  global.__typeormDataSource ??
  new DataSource({
    type: "mongodb",
    url: process.env.MONGODB_URI,
    database: process.env.MONGODB_DB,
    synchronize: true, // fine for dev; switch off + use migrations in prod
    entities: [User, BrokerToken, PcrSnapshot],
  });

if (process.env.NODE_ENV !== "production") {
  global.__typeormDataSource = AppDataSource;
}

export async function getDataSource() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();

    const tokenRepo = AppDataSource.getMongoRepository(BrokerToken);
    await tokenRepo.createCollectionIndex(
      { expiresAtDate: 1 },
      { expireAfterSeconds: 0 },
    );

    const pcrRepo = AppDataSource.getMongoRepository(PcrSnapshot);
    await pcrRepo.createCollectionIndex({ symbol: 1, expiry: 1, timestamp: 1 });
    await pcrRepo.createCollectionIndex({ dateKeyIST: 1 });
  }
  return AppDataSource;
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
