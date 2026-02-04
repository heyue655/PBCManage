import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('login_logs')
export class LoginLog {
  @PrimaryGeneratedColumn()
  log_id: number;

  @Column()
  user_id: number;

  @Column({ type: 'datetime' })
  login_time: Date;

  @Column({ type: 'datetime', nullable: true })
  logout_time: Date;

  @Column({ nullable: true })
  ip_address: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
