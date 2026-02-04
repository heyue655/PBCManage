-- PBC绩效管理系统数据库初始化脚本
-- 创建数据库
CREATE DATABASE IF NOT EXISTS pbc_manage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pbc_manage;

-- 1. 部门表
CREATE TABLE IF NOT EXISTS departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(255) NOT NULL,
    parent_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES departments(department_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 用户表
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    real_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    department_id INT NULL,
    supervisor_id INT NULL,
    role ENUM('employee', 'assistant', 'manager', 'gm') NOT NULL DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE SET NULL,
    FOREIGN KEY (supervisor_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. PBC周期表
CREATE TABLE IF NOT EXISTS pbc_periods (
    period_id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    quarter INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_period (year, quarter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. PBC目标表
CREATE TABLE IF NOT EXISTS pbc_goals (
    goal_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    period_id INT NULL,
    goal_type ENUM('business', 'skill', 'team') NOT NULL,
    goal_name VARCHAR(255) NOT NULL,
    goal_description TEXT NOT NULL,
    goal_weight DECIMAL(5,2) NOT NULL,
    parent_goal_id INT NULL,
    supervisor_goal_id INT NULL,
    measures TEXT NULL,
    unacceptable TEXT NULL,
    acceptable TEXT NULL,
    excellent TEXT NULL,
    completion_time DATE NULL,
    status ENUM('draft', 'submitted', 'approved', 'rejected', 'archived') NOT NULL DEFAULT 'draft',
    self_score DECIMAL(5,2) NULL,
    self_comment TEXT NULL,
    supervisor_score DECIMAL(5,2) NULL,
    supervisor_comment TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES pbc_periods(period_id) ON DELETE SET NULL,
    FOREIGN KEY (parent_goal_id) REFERENCES pbc_goals(goal_id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_goal_id) REFERENCES pbc_goals(goal_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. PBC审批记录表
CREATE TABLE IF NOT EXISTS pbc_approvals (
    approval_id INT AUTO_INCREMENT PRIMARY KEY,
    goal_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    action ENUM('submit', 'approve', 'reject') NOT NULL,
    comments TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (goal_id) REFERENCES pbc_goals(goal_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. 登录日志表
CREATE TABLE IF NOT EXISTS login_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    login_time DATETIME NOT NULL,
    logout_time DATETIME NULL,
    ip_address VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建索引
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_supervisor ON users(supervisor_id);
CREATE INDEX idx_pbc_goals_user ON pbc_goals(user_id);
CREATE INDEX idx_pbc_goals_period ON pbc_goals(period_id);
CREATE INDEX idx_pbc_goals_status ON pbc_goals(status);
CREATE INDEX idx_pbc_approvals_goal ON pbc_approvals(goal_id);
CREATE INDEX idx_login_logs_user ON login_logs(user_id);
