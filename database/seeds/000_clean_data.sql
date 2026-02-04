-- 清空所有数据，重新导入
USE pbc_manage;

-- 禁用外键约束
SET FOREIGN_KEY_CHECKS = 0;

-- 清空所有表数据
TRUNCATE TABLE login_logs;
TRUNCATE TABLE pbc_approvals;
TRUNCATE TABLE pbc_goals;
TRUNCATE TABLE pbc_periods;
TRUNCATE TABLE users;
TRUNCATE TABLE departments;

-- 启用外键约束
SET FOREIGN_KEY_CHECKS = 1;
