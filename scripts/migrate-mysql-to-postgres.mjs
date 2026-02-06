import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mysqlConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'beybladex_tournament'
};

const parseJson = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return false;
};

const resetSequence = async (table, column) => {
  const sql = `SELECT setval(pg_get_serial_sequence('"${table}"', '${column}'), COALESCE(MAX("${column}"), 1), true) FROM "${table}";`;
  await prisma.$executeRawUnsafe(sql);
};

const main = async () => {
  console.log('Connecting to MySQL...');
  const mysqlConnection = await mysql.createConnection(mysqlConfig);

  try {
    console.log('Reading MySQL data...');
    const [users] = await mysqlConnection.query('SELECT * FROM users');
    const [communities] = await mysqlConnection.query('SELECT * FROM communities');
    const [players] = await mysqlConnection.query('SELECT * FROM players');
    const [judges] = await mysqlConnection.query('SELECT * FROM judges');
    const [tournaments] = await mysqlConnection.query('SELECT * FROM challonge_tournaments');
    const [playerStats] = await mysqlConnection.query('SELECT * FROM player_stats');

    console.log('Writing to Postgres with Prisma...');

    await prisma.$transaction(async (tx) => {
      if (users.length > 0) {
        await tx.user.createMany({
          data: users.map((row) => ({
            user_id: row.user_id,
            username: row.username,
            email: row.email,
            password: row.password,
            name: row.name,
            player_name: row.player_name ?? null,
            challonge_username: row.challonge_username ?? null,
            api_key: row.api_key ?? null,
            user_role: row.user_role,
            created_at: toDate(row.created_at) ?? new Date(),
            updated_at: toDate(row.updated_at) ?? new Date()
          })),
          skipDuplicates: true
        });
      }

      if (communities.length > 0) {
        await tx.community.createMany({
          data: communities.map((row) => ({
            community_id: row.community_id,
            name: row.name,
            short_name: row.short_name,
            logo: row.logo ?? null,
            cover: row.cover ?? null,
            location: row.location ?? null,
            province: row.province ?? null,
            city: row.city ?? null,
            to_id: row.to_id ?? null,
            created_at: toDate(row.created_at) ?? new Date(),
            updated_at: toDate(row.updated_at) ?? new Date()
          })),
          skipDuplicates: true
        });
      }

      if (players.length > 0) {
        await tx.player.createMany({
          data: players.map((row) => ({
            player_id: row.player_id,
            username: row.username,
            password: row.password,
            name: row.name,
            player_name: row.player_name,
            community_ids: parseJson(row.community_ids),
            created_at: toDate(row.created_at) ?? new Date(),
            updated_at: toDate(row.updated_at) ?? new Date()
          })),
          skipDuplicates: true
        });
      }

      if (judges.length > 0) {
        await tx.judge.createMany({
          data: judges.map((row) => ({
            judge_id: row.judge_id,
            username: row.username,
            password: row.password,
            qr_code: row.qr_code ?? null,
            judge_name: row.judge_name ?? null,
            name: row.name ?? null,
            community_ids: parseJson(row.community_ids),
            created_at: toDate(row.created_at) ?? new Date(),
            updated_at: toDate(row.updated_at) ?? new Date()
          })),
          skipDuplicates: true
        });
      }

      if (tournaments.length > 0) {
        await tx.challongeTournament.createMany({
          data: tournaments.map((row) => ({
            ch_id: row.ch_id,
            challonge_id: row.challonge_id,
            challonge_url: row.challonge_url,
            challonge_name: row.challonge_name,
            challonge_cover: row.challonge_cover ?? null,
            description: row.description ?? null,
            tournament_date: toDate(row.tournament_date) ?? new Date(),
            active: toBool(row.active),
            total_stadium: row.total_stadium ?? 1,
            assigned_judge_ids: parseJson(row.assigned_judge_ids),
            pre_registered_players: parseJson(row.pre_registered_players),
            to_id: row.to_id ?? null,
            created_at: toDate(row.created_at) ?? new Date(),
            updated_at: toDate(row.updated_at) ?? new Date()
          })),
          skipDuplicates: true
        });
      }

      if (playerStats.length > 0) {
        await tx.playerStat.createMany({
          data: playerStats.map((row) => ({
            stat_id: row.stat_id,
            challonge_id: row.challonge_id,
            player_id: row.player_id,
            match_id: String(row.match_id),
            spin: row.spin ?? 0,
            burst: row.burst ?? 0,
            over: row.over ?? 0,
            extreme: row.extreme ?? 0,
            penalty: row.penalty ?? 0,
            match_result: row.match_result,
            stadium_side: row.stadium_side,
            match_status: row.match_status,
            match_stage: row.match_stage ?? null,
            created_at: toDate(row.created_at) ?? new Date(),
            updated_at: toDate(row.updated_at) ?? new Date()
          })),
          skipDuplicates: true
        });
      }
    });

    console.log('Resetting Postgres sequences...');
    await resetSequence('users', 'user_id');
    await resetSequence('communities', 'community_id');
    await resetSequence('players', 'player_id');
    await resetSequence('judges', 'judge_id');
    await resetSequence('challonge_tournaments', 'ch_id');
    await resetSequence('player_stats', 'stat_id');

    console.log('Migration completed successfully.');
  } finally {
    await mysqlConnection.end();
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
