import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PeriodStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Entity('pbc_periods')
export class PbcPeriod {
  @PrimaryGeneratedColumn()
  period_id: number;

  @Column()
  year: number;

  @Column()
  quarter: number;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({ type: 'enum', enum: PeriodStatus, default: PeriodStatus.ACTIVE })
  status: PeriodStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
