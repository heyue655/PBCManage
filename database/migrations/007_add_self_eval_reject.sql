-- 添加自评驳回相关字段
ALTER TABLE pbc_evaluations ADD COLUMN self_eval_reject_reason TEXT NULL;
ALTER TABLE pbc_evaluations ADD COLUMN self_eval_rejected_at DATETIME NULL;
