-- Migration 007: Add pbc_tasks table for task distribution flow
-- Assistant/GM can distribute quarterly PBC tasks to employees
-- Employees see these tasks in "My PBC" and fill in their goals within each task

CREATE TABLE IF NOT EXISTS pbc_tasks (
  task_id        INT          NOT NULL AUTO_INCREMENT,
  user_id        INT          NOT NULL COMMENT '接收任务的用户',
  period_id      INT          NOT NULL COMMENT '对应的季度周期',
  distributed_by INT          NOT NULL COMMENT '下发人（助理或总经理）',
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (task_id),
  UNIQUE KEY unique_user_period (user_id, period_id),
  KEY idx_user_id (user_id),
  KEY idx_period_id (period_id),
  KEY idx_distributed_by (distributed_by),

  CONSTRAINT fk_pbc_tasks_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_pbc_tasks_period
    FOREIGN KEY (period_id) REFERENCES pbc_periods(period_id) ON DELETE RESTRICT,
  CONSTRAINT fk_pbc_tasks_distributor
    FOREIGN KEY (distributed_by) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='PBC季度任务下发表';
