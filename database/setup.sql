-- Complete setup script for Beyblade Tournament Management System
-- This file combines schema creation and sample data insertion

-- Create database and schema
SOURCE schema.sql;

-- Insert sample data
SOURCE sample_data.sql;

-- Verify installation
SELECT 'Database setup completed successfully!' as Status;
SELECT COUNT(*) as Total_Tables FROM information_schema.tables WHERE table_schema = 'beybladex_tournament';
SELECT table_name as Created_Tables FROM information_schema.tables WHERE table_schema = 'beybladex_tournament';