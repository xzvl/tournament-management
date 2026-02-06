# Database Setup Instructions

## Overview
This directory contains the database schema and sample data for the Beyblade Tournament Management System.

## Files
- `schema.sql` - Complete database schema with all tables and indexes
- `sample_data.sql` - Sample test data for development and testing
- `setup.sql` - Combined setup script (schema + sample data)

## Database Structure

### Tables Created:
1. **users** - System users with roles (admin, player, judge, community_admin)
2. **communities** - Beyblade communities/organizations
3. **players** - Player-specific information and community associations
4. **judges** - Judge information with QR codes and community access
5. **challonge_tournaments** - Tournament data from Challonge integration
6. **player_stats** - Individual match statistics and results

## Setup Instructions

### Option 1: Using XAMPP MySQL
1. Start XAMPP and ensure MySQL is running
2. Open phpMyAdmin (http://localhost/phpmyadmin)
3. Import `schema.sql` to create the database and tables
4. Import `sample_data.sql` to add test data (optional)

### Option 2: Using MySQL Command Line
```bash
# Create and setup database
mysql -u root -p < database/schema.sql

# Add sample data (optional)
mysql -u root -p < database/sample_data.sql
```

### Option 3: All-in-one Setup
```bash
mysql -u root -p < database/setup.sql
```

## Database Configuration
Update your Next.js application with the following environment variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=beybladex_tournament
DB_USER=root
DB_PASSWORD=your_mysql_password
```

## Key Features
- **JSON Fields**: `community_ids` and `assigned_judge_ids` use JSON for flexible array storage
- **Indexes**: Optimized for common queries (username lookups, tournament searches)
- **Foreign Keys**: Proper relationships between tables
- **Timestamps**: Automatic created_at and updated_at fields
- **Enums**: Constrained values for roles, match results, and status fields

## Security Notes
- All passwords in sample data are hashed (replace with actual bcrypt hashes)
- API keys should be encrypted and stored securely
- QR codes should be generated and stored as base64 or file references

## Next Steps
1. Install a MySQL driver for Node.js (mysql2 recommended)
2. Create database connection utilities
3. Implement API routes for CRUD operations
4. Add authentication middleware
5. Create data models/types for TypeScript