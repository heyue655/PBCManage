-- 钉钉应用配置初始数据
-- 执行时间: 2026-01-26

USE pbc_management;

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
