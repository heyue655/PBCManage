-- 创建整体评价表
CREATE TABLE IF NOT EXISTS pbc_evaluations (
  evaluation_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  period_id INT NOT NULL,
  self_overall_comment TEXT,
  self_submitted_at DATETIME,
  supervisor_overall_comment TEXT,
  supervisor_submitted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_user_period (user_id, period_id),
  INDEX idx_user_id (user_id),
  INDEX idx_period_id (period_id),
  
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES pbc_periods(period_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
