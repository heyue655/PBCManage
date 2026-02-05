-- 创建钉钉应用配置表
-- 执行时间: 2026-01-26

USE pbc_management;

-- 创建钉钉应用配置表
CREATE TABLE IF NOT EXISTS dingtalk_apps (
  app_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '应用ID',
  organization VARCHAR(50) NOT NULL UNIQUE COMMENT '所属组织',
  app_name VARCHAR(100) NOT NULL COMMENT '应用名称',
  agent_id VARCHAR(100) NOT NULL COMMENT 'AgentId',
  corp_id VARCHAR(100) NOT NULL COMMENT 'CorpId',
  app_key VARCHAR(100) NOT NULL COMMENT 'AppKey',
  app_secret VARCHAR(255) NOT NULL COMMENT 'AppSecret',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_organization (organization),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉应用配置表';
