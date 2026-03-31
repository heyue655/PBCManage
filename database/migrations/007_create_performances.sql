-- 007: Create pbc_performances table for performance management
CREATE TABLE IF NOT EXISTS `pbc_performances` (
  `performance_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `period_id` INT NOT NULL,
  `evaluation_id` INT NOT NULL,
  `performance_level` VARCHAR(50) NULL,
  `performance_comment` TEXT NULL,
  `has_ai_contribution` TINYINT(1) NULL,
  `ai_performance_comment` TEXT NULL,
  `bottom_mgmt_status` VARCHAR(100) NULL,
  `planned_elimination_date` DATE NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`performance_id`),
  UNIQUE INDEX `pbc_performances_evaluation_id_key` (`evaluation_id`),
  UNIQUE INDEX `pbc_performances_user_id_period_id_key` (`user_id`, `period_id`),
  INDEX `pbc_performances_user_id_idx` (`user_id`),
  INDEX `pbc_performances_period_id_idx` (`period_id`),
  INDEX `pbc_performances_evaluation_id_idx` (`evaluation_id`),
  CONSTRAINT `pbc_performances_evaluation_id_fkey` FOREIGN KEY (`evaluation_id`) REFERENCES `pbc_evaluations`(`evaluation_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pbc_performances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pbc_performances_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `pbc_periods`(`period_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
