-- Migration 010: Add goal_nature to pbc_goals
-- qualitative: 定性, quantitative: 定量

ALTER TABLE pbc_goals
  ADD COLUMN goal_nature ENUM('qualitative', 'quantitative') NULL AFTER goal_type;

UPDATE pbc_goals
SET goal_nature = CASE
  WHEN goal_type = 'business' THEN 'quantitative'
  ELSE 'qualitative'
END
WHERE goal_nature IS NULL;

ALTER TABLE pbc_goals
  MODIFY COLUMN goal_nature ENUM('qualitative', 'quantitative') NOT NULL DEFAULT 'qualitative';
