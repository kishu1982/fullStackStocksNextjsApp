//singleton pattern so hot-reload / serverless invocations don't open a new connection every call:

import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User.entity";
import { BrokerToken } from "./entities/BrokerToken.entity";

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
    entities: [User, BrokerToken],
  });

if (process.env.NODE_ENV !== "production") {
  global.__typeormDataSource = AppDataSource;
}

export async function getDataSource() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();

    const repo = AppDataSource.getMongoRepository(BrokerToken);
    await repo.createCollectionIndex(
      { expiresAtDate: 1 },
      { expireAfterSeconds: 0 }, // Mongo deletes the doc automatically once expiresAtDate passes
    );
  }
  return AppDataSource;
}
