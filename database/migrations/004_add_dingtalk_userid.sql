-- 添加钉钉userid字段到users表
-- 执行时间: 2026-01-26

USE pbc_management;

ALTER TABLE users ADD COLUMN dingtalk_userid VARCHAR(255) NULL COMMENT '钉钉用户ID' AFTER role;
