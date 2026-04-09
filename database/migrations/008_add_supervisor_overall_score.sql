-- 添加整体主管评分字段
ALTER TABLE pbc_evaluations
  ADD COLUMN IF NOT EXISTS supervisor_overall_score INT NULL COMMENT '整体主管评分';
