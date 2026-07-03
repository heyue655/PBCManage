-- 添加系统管理员用户 (admin / admin@123)
USE pbc_manage;

INSERT INTO users (username, password, real_name, job_title, department_id, supervisor_id, role, organization)
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
