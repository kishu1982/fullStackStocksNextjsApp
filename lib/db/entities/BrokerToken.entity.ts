import "reflect-metadata";
import {
  Entity,
  ObjectIdColumn,
  ObjectId,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("broker_tokens")
export class BrokerToken {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  uid!: string;

  @Column()
  accessToken!: string;

  @Column()
  refreshToken!: string;

  @Column()
  expiresAt!: number;

  @Column()
  expiresAtDate!: Date; // same moment, as a Date — Mongo TTL index target

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
