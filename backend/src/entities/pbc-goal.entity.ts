import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { PbcPeriod } from './pbc-period.entity';

export enum GoalType {
  BUSINESS = 'business',           // 个人业务目标
  SKILL = 'skill',                 // 个人能力提升
  TEAM = 'team',                   // 团队业务目标
}

export enum PbcStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

@Entity('pbc_goals')
export class PbcGoal {
  @PrimaryGeneratedColumn()
  goal_id: number;

  @Column()
  user_id: number;

  @Column({ nullable: true })
  period_id: number;

  @Column({ type: 'enum', enum: GoalType })
  goal_type: GoalType;

  @Column()
  goal_name: string;

  @Column({ type: 'text' })
  goal_description: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  goal_weight: number;

  @Column({ nullable: true })
  parent_goal_id: number;

  @Column({ nullable: true })
  supervisor_goal_id: number;

  @Column({ type: 'text', nullable: true })
  measures: string; // 实现举措

  @Column({ type: 'text', nullable: true })
  unacceptable: string;

  @Column({ type: 'text', nullable: true })
  acceptable: string;

  @Column({ type: 'text', nullable: true })
  excellent: string;

  @Column({ type: 'date', nullable: true })
  completion_time: Date;

  @Column({ type: 'enum', enum: PbcStatus, default: PbcStatus.DRAFT })
  status: PbcStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  self_score: number;

  @Column({ type: 'text', nullable: true })
  self_comment: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  supervisor_score: number;

  @Column({ type: 'text', nullable: true })
  supervisor_comment: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PbcPeriod, { nullable: true })
  @JoinColumn({ name: 'period_id' })
  period: PbcPeriod;

  @ManyToOne(() => PbcGoal, { nullable: true })
  @JoinColumn({ name: 'parent_goal_id' })
  parentGoal: PbcGoal;

  @OneToMany(() => PbcGoal, goal => goal.parentGoal)
  subGoals: PbcGoal[];

  @ManyToOne(() => PbcGoal, { nullable: true })
  @JoinColumn({ name: 'supervisor_goal_id' })
  supervisorGoal: PbcGoal;
}
