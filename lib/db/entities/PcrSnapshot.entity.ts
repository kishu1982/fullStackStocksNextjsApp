import "reflect-metadata";
import {
  Entity,
  ObjectIdColumn,
  ObjectId,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";

// One row = one (symbol, expiry) sample captured during the 9:00–16:00 IST window.
@Entity("pcr_snapshots")
@Index(["symbol", "expiry", "timestamp"])
@Index(["dateKeyIST"])
export class PcrSnapshot {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  symbol!: string; // NIFTY, BANKNIFTY, SENSEX

  @Column()
  exchange!: string; // NFO / BFO

  @Column()
  expiry!: string; // e.g. "15-SEP-2026"

  @Column()
  timestamp!: Date;
  // Exact capture moment.
  // MongoDB stores this as an absolute BSON Date.

  @Column()
  dateKeyIST!: string;
  // YYYY-MM-DD in IST

  @Column()
  pcr!: number;

  @Column()
  totalCallOI!: number;

  @Column()
  totalPutOI!: number;

  @Column()
  maxPainStrike!: number;

  @Column()
  futuresLTP!: number;

  @Column()
  futuresToken!: string;

  @Column({ nullable: true })
  futuresExpiryUsed?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
