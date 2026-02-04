import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Department } from './department.entity';

export enum UserRole {
  EMPLOYEE = 'employee',
  ASSISTANT = 'assistant',
  MANAGER = 'manager',
  GENERAL_MANAGER = 'gm',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  real_name: string;

  @Column()
  job_title: string;

  @Column({ nullable: true })
  department_id: number;

  @Column({ nullable: true })
  supervisor_id: number;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'supervisor_id' })
  supervisor: User;

  @OneToMany(() => User, user => user.supervisor)
  subordinates: User[];
}
