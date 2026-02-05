-- 修复钉钉应用表的日期字段
-- 执行时间: 2026-02-05

USE pbc_management;

-- 方案1: 删除表并重新创建（如果表中没有重要数据）
DROP TABLE IF EXISTS dingtalk_apps;

-- 重新创建表
CREATE TABLE dingtalk_apps (
  app_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '应用ID',
  organization VARCHAR(50) NOT NULL UNIQUE COMMENT '所属组织',
  app_name VARCHAR(100) NOT NULL COMMENT '应用名称',
  agent_id VARCHAR(100) NOT NULL COMMENT 'AgentId',
  corp_id VARCHAR(100) NOT NULL COMMENT 'CorpId',
  app_key VARCHAR(100) NOT NULL COMMENT 'AppKey',
  app_secret VARCHAR(255) NOT NULL COMMENT 'AppSecret',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_organization (organization),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉应用配置表';

-- 插入安恒组织钉钉应用配置
INSERT INTO dingtalk_apps (organization, app_name, agent_id, corp_id, app_key, app_secret, is_active) 
VALUES (
  '安恒',
  '安恒PBC管理',
  '4219954506',
  'ding0434d73b09f8fd4e',
  'dingcf5da3sc90itnjb9',
  'CI_IG7tpx0XLGFAYnYmh4JM-lnDLts4dLzSl-qlap30FsN73Dc15BRvg7aAL0ypx',
  TRUE
);

-- 插入中宇华兴组织钉钉应用配置
INSERT INTO dingtalk_apps (organization, app_name, agent_id, corp_id, app_key, app_secret, is_active) 
VALUES (
  '中宇华兴',
  '中宇华兴PBC管理',
  '4247026873',
  'ding8e18ef801ca2cbda24f2f5cc6abecb85',
  'dingnmpozxqkbpqsor70',
  'YrgG0rCo8tfQBF9ThL66wc7cu3VKXZST-04D1knS14hF9wNKVIVRdMf-sKFlCnW5',
  TRUE
);

-- 验证数据
SELECT * FROM dingtalk_apps;
