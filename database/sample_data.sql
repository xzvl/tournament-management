-- Sample data for Beyblade Tournament Management System
-- Use this file to populate the database with test data

USE `beybladex_tournament`;

-- Insert sample communities
INSERT INTO `communities` (`name`, `short_name`, `logo`, `cover`, `location`, `province`, `city`, `to_id`) VALUES
('Beyblade Masters Manila', 'BMM', '/logos/bmm-logo.png', '/covers/bmm-cover.jpg', 'Manila', 'Metro Manila', 'Manila', 'BMM001'),
('Philippine Beyblade Association', 'PBA', '/logos/pba-logo.png', '/covers/pba-cover.jpg', 'Quezon City', 'Metro Manila', 'Quezon City', 'PBA001'),
('Cebu Beyblade Warriors', 'CBW', '/logos/cbw-logo.png', '/covers/cbw-cover.jpg', 'Cebu City', 'Cebu', 'Cebu City', 'CBW001');

-- Insert sample users
INSERT INTO `users` (`username`, `email`, `password`, `name`, `player_name`, `challonge_username`, `api_key`, `user_role`) VALUES
('admin', 'admin@beybladex.com', 'admin123', 'System Administrator', NULL, 'admin_challonge', 'challonge_api_key_here', 'admin'),
('organizer01', 'manila@beybladex.com', 'org123', 'Manila Tournament Organizer', NULL, 'manila_org', 'api_key_manila', 'tournament_organizer'),
('organizer02', 'cebu@beybladex.com', 'org123', 'Cebu Tournament Organizer', NULL, 'cebu_org', 'api_key_cebu', 'tournament_organizer'),
('organizer03', 'national@beybladex.com', 'org123', 'National Tournament Organizer', NULL, 'national_org', 'api_key_national', 'tournament_organizer'),
('organizer04', 'regional@beybladex.com', 'org123', 'Regional Tournament Organizer', NULL, 'regional_org', 'api_key_regional', 'tournament_organizer');

-- Insert sample players
INSERT INTO `players` (`username`, `password`, `name`, `player_name`, `community_ids`) VALUES
('alice_player', '$2b$10$hash_password_here', 'Alice Smith', 'Thunder Alice', '[1, 2]'),
('bob_player', '$2b$10$hash_password_here', 'Bob Johnson', 'Lightning Bob', '[1]'),
('charlie_player', '$2b$10$hash_password_here', 'Charlie Brown', 'Storm Charlie', '[2, 3]'),
('diana_player', '$2b$10$hash_password_here', 'Diana Prince', 'Blazing Diana', '[1, 3]');

-- Insert sample judges
INSERT INTO `judges` (`username`, `password`, `qr_code`, `community_ids`) VALUES
('judge01', '$2b$10$hash_password_here', 'QR_CODE_JUDGE01', '[1, 2]'),
('judge02', '$2b$10$hash_password_here', 'QR_CODE_JUDGE02', '[2, 3]'),
('judge03', '$2b$10$hash_password_here', 'QR_CODE_JUDGE03', '[1, 3]');

-- Insert sample challonge tournaments
INSERT INTO `challonge_tournaments` (`challonge_id`, `challonge_url`, `challonge_name`, `challonge_cover`, `description`, `tournament_date`, `active`, `total_stadium`, `assigned_judge_ids`, `pre_registered_players`) VALUES
('tournament001', 'https://challonge.com/tournament001', 'Manila Masters Championship 2026', '/tournament-covers/manila-masters-2026.jpg', 'The premier Beyblade tournament in Manila featuring top players from across the Philippines.', '2026-02-15', true, 4, '[1, 2]', '["Mark", "Cardona"]'),
('tournament002', 'https://challonge.com/tournament002', 'Cebu Open Tournament', '/tournament-covers/cebu-open-2026.jpg', 'Open tournament for all skill levels in Cebu City.', '2026-03-01', true, 2, '[2, 3]', '[]'),
('tournament003', 'https://challonge.com/tournament003', 'National Championships 2026', '/tournament-covers/nationals-2026.jpg', 'The official Philippine National Beyblade Championships.', '2026-04-20', false, 6, '[1, 2, 3]', '[]');

-- Insert sample player stats
INSERT INTO `player_stats` (`challonge_id`, `player_id`, `match_id`, `spin`, `burst`, `over`, `extreme`, `penalty`, `match_result`, `stadium_side`, `match_status`, `match_stage`) VALUES
('tournament001', 1, 'match001', 2, 1, 0, 0, 0, 'win', 'X Side', 'completed', 'quarterfinals'),
('tournament001', 2, 'match001', 1, 0, 1, 0, 1, 'loss', 'B Side', 'completed', 'quarterfinals'),
('tournament001', 1, 'match002', 1, 2, 0, 1, 0, 'win', 'B Side', 'completed', 'semifinals'),
('tournament001', 3, 'match002', 0, 1, 2, 0, 0, 'loss', 'X Side', 'completed', 'semifinals'),
('tournament002', 2, 'match003', 3, 0, 0, 0, 0, 'win', 'X Side', 'in_progress', 'finals'),
('tournament002', 4, 'match003', 0, 0, 2, 1, 0, 'loss', 'B Side', 'in_progress', 'finals');