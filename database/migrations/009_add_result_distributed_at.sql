-- 添加绩效结果下发时间字段
ALTER TABLE pbc_performances
  ADD COLUMN IF NOT EXISTS result_distributed_at DATETIME NULL COMMENT '绩效结果下发时间';
