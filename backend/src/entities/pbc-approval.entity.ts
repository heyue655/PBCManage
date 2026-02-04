import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { PbcGoal } from './pbc-goal.entity';

export enum ApprovalAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
}

@Entity('pbc_approvals')
export class PbcApproval {
  @PrimaryGeneratedColumn()
  approval_id: number;

  @Column()
  goal_id: number;

  @Column()
  reviewer_id: number;

  @Column({ type: 'enum', enum: ApprovalAction })
  action: ApprovalAction;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => PbcGoal)
  @JoinColumn({ name: 'goal_id' })
  goal: PbcGoal;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;
}
