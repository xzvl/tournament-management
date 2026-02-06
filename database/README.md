# Database Setup Instructions

## Overview
This project now uses Prisma + PostgreSQL. The SQL files in this folder are legacy MySQL artifacts kept for reference only.

## Prisma Schema
- The source of truth is [prisma/schema.prisma](../prisma/schema.prisma).
- Use Prisma migrations to create/update the PostgreSQL schema.

## PostgreSQL Setup (Dev)
1. Provision a local PostgreSQL database.
2. Add a `DATABASE_URL` in your environment (for example in `.env`):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/beybladex_tournament?schema=public"
```

3. Run Prisma migrations:

```bash
npm run prisma:migrate
```

## MySQL to Postgres Data Migration (Optional)
If you have an existing MySQL database and need to migrate data, use the provided script:

```bash
npm run migrate:mysql-to-postgres
```

The script reads from MySQL using `MYSQL_*` env vars (or falls back to the old `DB_*` vars):

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=beybladex_tournament
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
```

## Key Features
- JSON fields (`community_ids`, `assigned_judge_ids`, `pre_registered_players`) are stored as JSONB in Postgres.
- Prisma manages timestamps and schema changes.

## Security Notes
- All passwords in sample data are hashed (replace with actual bcrypt hashes).
- API keys should be encrypted and stored securely.

## Next Steps
1. Run `npm run prisma:generate` after installing dependencies.
2. Apply migrations with `npm run prisma:migrate`.
3. Start the app with `npm run dev`.