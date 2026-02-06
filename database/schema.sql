-- Beyblade Tournament Management System Database Schema
-- Created: January 28, 2026

CREATE DATABASE IF NOT EXISTS `beybladex_tournament` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `beybladex_tournament`;

-- User table
CREATE TABLE `users` (
    `user_id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) UNIQUE NOT NULL,
    `email` VARCHAR(255) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `player_name` VARCHAR(100),
    `challonge_username` VARCHAR(50),
    `api_key` VARCHAR(255),
    `user_role` ENUM('admin', 'tournament_organizer') NOT NULL DEFAULT 'tournament_organizer',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Community table
CREATE TABLE `communities` (
    `community_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `short_name` VARCHAR(20) NOT NULL,
    `logo` VARCHAR(255),
    `cover` VARCHAR(255),
    `location` VARCHAR(100),
    `province` VARCHAR(50),
    `city` VARCHAR(50),
    `to_id` VARCHAR(50), -- Assuming this is an external ID reference
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Player table
CREATE TABLE `players` (
    `player_id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `player_name` VARCHAR(100) NOT NULL,
    `community_ids` JSON, -- Store array of community IDs as JSON
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_player_name (`player_name`)
);

-- Judge table
CREATE TABLE `judges` (
    `judge_id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `qr_code` VARCHAR(255),
    `community_ids` JSON, -- Store array of community IDs as JSON
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Challonge tournaments table
CREATE TABLE `challonge_tournaments` (
    `ch_id` INT AUTO_INCREMENT PRIMARY KEY,
    `challonge_id` VARCHAR(100) UNIQUE NOT NULL,
    `challonge_url` VARCHAR(255) NOT NULL,
    `challonge_name` VARCHAR(100) NOT NULL,
    `challonge_cover` VARCHAR(255),
    `description` TEXT,
    `tournament_date` DATE NOT NULL,
    `active` BOOLEAN DEFAULT true,
    `total_stadium` INT DEFAULT 1,
    `assigned_judge_ids` JSON, -- Store array of judge IDs as JSON
    `pre_registered_players` JSON,
    `to_id` INT, -- Tournament organizer (user_id)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_challonge_id (`challonge_id`),
    INDEX idx_tournament_date (`tournament_date`),
    INDEX idx_to_id (`to_id`),
    FOREIGN KEY (to_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Player statistics table
CREATE TABLE `player_stats` (
    `stat_id` INT AUTO_INCREMENT PRIMARY KEY,
    `challonge_id` VARCHAR(100) NOT NULL,
    `player_id` INT NOT NULL,
    `match_id` VARCHAR(100) NOT NULL,
    `spin` INT DEFAULT 0,
    `burst` INT DEFAULT 0,
    `over` INT DEFAULT 0,
    `extreme` INT DEFAULT 0,
    `penalty` INT DEFAULT 0,
    `match_result` ENUM('win', 'loss', 'draw') NOT NULL,
    `stadium_side` ENUM('X Side', 'B Side') NOT NULL,
    `match_status` ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    `match_stage` VARCHAR(50), -- e.g., 'quarterfinals', 'semifinals', 'finals'
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`player_id`) REFERENCES `players`(`player_id`) ON DELETE CASCADE,
    INDEX idx_challonge_match (`challonge_id`, `match_id`),
    INDEX idx_player_stats (`player_id`, `challonge_id`)
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON `users`(`username`);
CREATE INDEX idx_users_email ON `users`(`email`);
CREATE INDEX idx_users_role ON `users`(`user_role`);
CREATE INDEX idx_communities_short_name ON `communities`(`short_name`);
CREATE INDEX idx_players_username ON `players`(`username`);
CREATE INDEX idx_judges_username ON `judges`(`username`);