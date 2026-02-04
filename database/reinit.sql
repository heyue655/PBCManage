-- 完整的数据重新初始化脚本
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

-- 插入部门数据
INSERT INTO departments (department_name, parent_id) VALUES
('数字化管理部', NULL);

-- 插入子部门
INSERT INTO departments (department_name, parent_id) VALUES
('数字化研发部', 1),
('应用规划部', 1);

-- 插入用户数据（密码为123456的bcrypt加密结果）
-- 密码: 123456 -> $2a$10$tW3U7t4EH/ij9z1HYbr5FOr0JXpzwmWBhPEUjbzeW9IqUF4y2DME2
INSERT INTO users (username, password, real_name, job_title, department_id, supervisor_id, role) VALUES
-- 总经理
('zijie', '$2a$10$tW3U7t4EH/ij9z1HYbr5FOr0JXpzwmWBhPEUjbzeW9IqUF4y2DME2', '子杰', '总经理', 1, NULL, 'gm'),

-- 部门经理
('heyue', '$2a$10$tW3U7t4EH/ij9z1HYbr5FOr0JXpzwmWBhPEUjbzeW9IqUF4y2DME2', '乐乐', '技术总监', 2, 1, 'manager'),

-- 技术部助理
('juzi', '$2a$10$tW3U7t4EH/ij9z1HYbr5FOr0JXpzwmWBhPEUjbzeW9IqUF4y2DME2', '橘子', '助理', 1, 1, 'assistant'),

-- 普通员工
('haibin', '$2a$10$tW3U7t4EH/ij9z1HYbr5FOr0JXpzwmWBhPEUjbzeW9IqUF4y2DME2', '海宾', '后端开发工程师', 2, 2, 'employee'),
('kanglei', '$2a$10$tW3U7t4EH/ij9z1HYbr5FOr0JXpzwmWBhPEUjbzeW9IqUF4y2DME2', '康镭', '前端开发工程师', 2, 2, 'employee');

-- 插入当前周期
INSERT INTO pbc_periods (year, quarter, start_date, end_date, status) VALUES
(2026, 1, '2026-01-01', '2026-03-31', 'active');

-- 插入示例PBC目标（技术总监的团队目标）
INSERT INTO pbc_goals (user_id, period_id, goal_type, goal_name, goal_description, goal_weight, status, unacceptable, acceptable, excellent) VALUES
(2, 1, 'team', '完成产品2.0版本开发', '带领技术团队完成产品2.0版本的核心功能开发，包括性能优化、新功能上线', 50.00, 'approved', 
'核心功能未完成50%', '按时完成核心功能开发，通过测试验收', '提前完成并超额完成附加功能'),
(2, 1, 'team', '技术团队能力提升', '组织技术培训，提升团队整体技术水平', 30.00, 'approved',
'未组织任何培训', '组织2次以上技术分享会', '建立完整的技术培训体系，人均参与3次以上'),
(2, 1, 'team', '代码质量管控', '建立代码规范，减少线上bug数量', 20.00, 'approved',
'线上bug数量增加', '线上bug数量减少20%', '线上bug数量减少50%以上');

-- 插入示例员工PBC目标
INSERT INTO pbc_goals (user_id, period_id, goal_type, goal_name, goal_description, goal_weight, supervisor_goal_id, status, measures, unacceptable, acceptable, excellent) VALUES
(4, 1, 'business', '完成用户模块重构', '对用户模块进行重构，提升系统性能', 40.00, 1, 'draft',
'1. 分析现有代码问题\n2. 设计新架构\n3. 逐步重构并测试',
'未完成重构或性能下降', '完成重构，性能提升20%', '性能提升50%以上，无bug');

INSERT INTO pbc_goals (user_id, period_id, goal_type, goal_name, goal_description, goal_weight, status, measures, completion_time) VALUES
(4, 1, 'skill', '学习微服务架构', '系统学习微服务架构，并应用到实际项目中', 20.00, 'draft',
'1. 阅读相关书籍和文档\n2. 完成在线课程\n3. 实践项目应用',
'2026-03-15');

SELECT '数据重新初始化完成' as message;
