-- Add to_id column to challonge_tournaments table to track tournament organizer
-- Run this script to add the missing column if it doesn't exist

ALTER TABLE `challonge_tournaments` 
ADD COLUMN `to_id` INT NULL AFTER `assigned_judge_ids`,
ADD INDEX idx_to_id (`to_id`),
ADD FOREIGN KEY (to_id) REFERENCES users(user_id) ON DELETE SET NULL;

-- Update existing tournaments to set to_id to the first admin user if available
UPDATE `challonge_tournaments` ct
SET ct.to_id = (
    SELECT u.user_id 
    FROM users u 
    WHERE u.user_role = 'admin' 
    LIMIT 1
)
WHERE ct.to_id IS NULL;