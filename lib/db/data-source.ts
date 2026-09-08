import "reflect-metadata";
import { DataSource } from "typeorm";

import { User } from "./entities/User.entity";
import { BrokerToken } from "./entities/BrokerToken.entity";
import { PcrSnapshot } from "./entities/PcrSnapshot.entity";

declare global {
  // eslint-disable-next-line no-var
  var __typeormDataSource: DataSource | undefined;

  // Prevent multiple simultaneous initialize() calls during
  // Next.js development / Turbopack HMR.
  // eslint-disable-next-line no-var
  var __typeormDataSourceInitPromise: Promise<DataSource> | undefined;
}

function createDataSource(): DataSource {
  return new DataSource({
    type: "mongodb",
    url: process.env.MONGODB_URI,
    database: process.env.MONGODB_DB,

    synchronize: true,

    entities: [User, BrokerToken, PcrSnapshot],
  });
}

async function initializeDataSource(ds: DataSource): Promise<DataSource> {
  if (!ds.isInitialized) {
    await ds.initialize();
  }

  /*
   * Create indexes only after the DataSource is initialized.
   *
   * These are non-fatal if MongoDB reports that an
   * equivalent index already exists.
   */
  try {
    const tokenRepo = ds.getMongoRepository(BrokerToken);

    await tokenRepo.createCollectionIndex(
      { expiresAtDate: 1 },
      {
        expireAfterSeconds: 0,
      },
    );

    const pcrRepo = ds.getMongoRepository(PcrSnapshot);

    await pcrRepo.createCollectionIndex({
      symbol: 1,
      expiry: 1,
      timestamp: 1,
    });

    await pcrRepo.createCollectionIndex({
      dateKeyIST: 1,
    });
  } catch (err: any) {
    console.warn("MongoDB collection index note:", err?.message || err);
  }

  return ds;
}

export async function getDataSource(): Promise<DataSource> {
  /*
   * ---------------------------------------------------------
   * IMPORTANT FOR NEXT.JS DEV / TURBOPACK
   *
   * Do NOT destroy an existing DataSource just because the
   * current HMR PcrSnapshot class reference is different.
   *
   * Destroying it can close MongoDB while the PCR scheduler
   * is currently saving a snapshot.
   * ---------------------------------------------------------
   */

  let ds = global.__typeormDataSource;

  /*
   * Existing initialized connection.
   *
   * We deliberately return it even if the current HMR module
   * has produced a different PcrSnapshot class reference.
   */
  if (ds?.isInitialized) {
    return ds;
  }

  /*
   * Existing DataSource object is still initializing.
   *
   * Wait for the same initialization instead of starting
   * another MongoDB connection.
   */
  if (ds && !ds.isInitialized && global.__typeormDataSourceInitPromise) {
    return global.__typeormDataSourceInitPromise;
  }

  /*
   * Create the singleton if one doesn't exist.
   */
  if (!ds) {
    ds = createDataSource();

    global.__typeormDataSource = ds;
  }

  /*
   * Prevent concurrent initialization.
   */
  if (!global.__typeormDataSourceInitPromise) {
    global.__typeormDataSourceInitPromise = initializeDataSource(ds)
      .then((initialized) => {
        global.__typeormDataSource = initialized;

        return initialized;
      })
      .finally(() => {
        global.__typeormDataSourceInitPromise = undefined;
      });
  }

  return global.__typeormDataSourceInitPromise;
}
