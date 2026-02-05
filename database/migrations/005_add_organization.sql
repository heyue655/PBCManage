-- 添加organization字段到users表
-- 执行时间: 2026-01-26

USE pbc_management;

-- 添加组织字段，默认值为"安恒"
ALTER TABLE users ADD COLUMN organization VARCHAR(50) NOT NULL DEFAULT '安恒' COMMENT '所属组织' AFTER role;
