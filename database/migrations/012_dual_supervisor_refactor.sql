-- 双主管考核改造 DDL
-- 迭代：双主管审批流程 + 系统配置 + 绩效等级自动计算

USE pbc_manage;

-- 1. users 表：重命名 supervisor_id -> functional_supervisor_id，新增 business_supervisor_id
ALTER TABLE users CHANGE supervisor_id functional_supervisor_id INT NULL;
ALTER TABLE users ADD COLUMN business_supervisor_id INT NULL AFTER functional_supervisor_id;
ALTER TABLE users ADD INDEX users_functional_supervisor_id_fkey (functional_supervisor_id);
ALTER TABLE users ADD INDEX users_business_supervisor_id_fkey (business_supervisor_id);

-- 2. 新建 system_configs 表（考核权重配置）
CREATE TABLE IF NOT EXISTS system_configs (
  config_id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(64) NOT NULL UNIQUE,
  config_value VARCHAR(255) NOT NULL,
  description VARCHAR(255),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO system_configs (config_key, config_value, description) VALUES
  ('evaluation_weight_functional', '30', '职能主管考核权重(%)'),
  ('evaluation_weight_business', '70', '业务主管考核权重(%)')
ON DUPLICATE KEY UPDATE config_value = config_value;

-- 3. pbc_goals 表：重命名 supervisor_score/comment -> functional_*，新增 business_*
ALTER TABLE pbc_goals CHANGE supervisor_score functional_supervisor_score DECIMAL(5,2) NULL;
ALTER TABLE pbc_goals CHANGE supervisor_comment functional_supervisor_comment TEXT NULL;
ALTER TABLE pbc_goals ADD COLUMN business_supervisor_score DECIMAL(5,2) NULL AFTER functional_supervisor_comment;
ALTER TABLE pbc_goals ADD COLUMN business_supervisor_comment TEXT NULL AFTER business_supervisor_score;

-- 4. pbc_evaluations 表：重命名 supervisor_* -> functional_*，新增 business_* 和 avg_weighted_score
ALTER TABLE pbc_evaluations CHANGE supervisor_overall_score functional_overall_score INT NULL;
ALTER TABLE pbc_evaluations CHANGE supervisor_overall_comment functional_overall_comment TEXT NULL;
ALTER TABLE pbc_evaluations CHANGE supervisor_submitted_at functional_submitted_at DATETIME NULL;
ALTER TABLE pbc_evaluations ADD COLUMN business_overall_score INT NULL AFTER functional_submitted_at;
ALTER TABLE pbc_evaluations ADD COLUMN business_overall_comment TEXT NULL AFTER business_overall_score;
ALTER TABLE pbc_evaluations ADD COLUMN business_submitted_at DATETIME NULL AFTER business_overall_comment;
ALTER TABLE pbc_evaluations ADD COLUMN avg_weighted_score DECIMAL(5,2) NULL AFTER business_submitted_at;

-- 5. pbc_approvals 表：新增 supervisor_type 字段
ALTER TABLE pbc_approvals ADD COLUMN supervisor_type VARCHAR(20) DEFAULT 'functional' AFTER comments;

-- 6. users 表：新增 managed_department_ids 字段（多部门助理支持）
ALTER TABLE users ADD COLUMN managed_department_ids JSON NULL AFTER department_id;

-- 7. 添加系统管理员用户 (admin / admin@123)
INSERT INTO users (username, password, real_name, job_title, department_id, functional_supervisor_id, role, organization)
VALUES (
  'admin',
  '$2a$10$m2UEeZl5./hHtDeGhk8RG.x3o.1BmkSZ6uBUorszKJ4dvfEhRHEiW',
  '管理员',
  '系统管理员',
  1,
  NULL,
  'gm',
  '安恒'
);
