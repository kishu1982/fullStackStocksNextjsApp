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
  expiry!: string; // e.g. "15-SEP-2026" — matches broker's `exd` format

  @Column()
  timestamp!: Date; // exact capture moment

  @Column()
  dateKeyIST!: string; // "YYYY-MM-DD" in IST — used for the 3-day retention cleanup

  @Column()
  pcr!: number; // totalPutOI / totalCallOI

  @Column()
  totalCallOI!: number;

  @Column()
  totalPutOI!: number;

  @Column()
  maxPainStrike!: number;

  @Column()
  futuresLTP!: number; // underlying future price used as "spot" for this expiry

  @Column()
  futuresToken!: string;

  @Column({ nullable: true })
  futuresExpiryUsed?: string; // which future contract's LTP was actually used

  @CreateDateColumn()
  createdAt!: Date;
}
