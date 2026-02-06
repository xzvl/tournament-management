-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'tournament_organizer');

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "player_name" TEXT,
    "challonge_username" TEXT,
    "api_key" TEXT,
    "user_role" "UserRole" NOT NULL DEFAULT 'tournament_organizer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "communities" (
    "community_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "logo" TEXT,
    "cover" TEXT,
    "location" TEXT,
    "province" TEXT,
    "city" TEXT,
    "to_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("community_id")
);

-- CreateTable
CREATE TABLE "players" (
    "player_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "player_name" TEXT NOT NULL,
    "community_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "judges" (
    "judge_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "qr_code" TEXT,
    "judge_name" TEXT,
    "name" TEXT,
    "community_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judges_pkey" PRIMARY KEY ("judge_id")
);

-- CreateTable
CREATE TABLE "challonge_tournaments" (
    "ch_id" SERIAL NOT NULL,
    "challonge_id" TEXT NOT NULL,
    "challonge_url" TEXT NOT NULL,
    "challonge_name" TEXT NOT NULL,
    "challonge_cover" TEXT,
    "description" TEXT,
    "tournament_date" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "total_stadium" INTEGER NOT NULL DEFAULT 1,
    "assigned_judge_ids" JSONB,
    "pre_registered_players" JSONB,
    "to_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challonge_tournaments_pkey" PRIMARY KEY ("ch_id")
);

-- CreateTable
CREATE TABLE "player_stats" (
    "stat_id" SERIAL NOT NULL,
    "challonge_id" TEXT NOT NULL,
    "player_id" INTEGER NOT NULL,
    "match_id" TEXT NOT NULL,
    "spin" INTEGER NOT NULL DEFAULT 0,
    "burst" INTEGER NOT NULL DEFAULT 0,
    "over" INTEGER NOT NULL DEFAULT 0,
    "extreme" INTEGER NOT NULL DEFAULT 0,
    "penalty" INTEGER NOT NULL DEFAULT 0,
    "match_result" TEXT NOT NULL,
    "stadium_side" TEXT NOT NULL,
    "match_status" TEXT NOT NULL,
    "match_stage" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_stats_pkey" PRIMARY KEY ("stat_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "communities_short_name_idx" ON "communities"("short_name");

-- CreateIndex
CREATE UNIQUE INDEX "players_username_key" ON "players"("username");

-- CreateIndex
CREATE INDEX "players_player_name_idx" ON "players"("player_name");

-- CreateIndex
CREATE UNIQUE INDEX "judges_username_key" ON "judges"("username");

-- CreateIndex
CREATE UNIQUE INDEX "challonge_tournaments_challonge_id_key" ON "challonge_tournaments"("challonge_id");

-- CreateIndex
CREATE INDEX "challonge_tournaments_tournament_date_idx" ON "challonge_tournaments"("tournament_date");

-- CreateIndex
CREATE INDEX "challonge_tournaments_to_id_idx" ON "challonge_tournaments"("to_id");

-- CreateIndex
CREATE INDEX "player_stats_challonge_id_match_id_idx" ON "player_stats"("challonge_id", "match_id");

-- CreateIndex
CREATE INDEX "player_stats_player_id_challonge_id_idx" ON "player_stats"("player_id", "challonge_id");

-- AddForeignKey
ALTER TABLE "challonge_tournaments" ADD CONSTRAINT "challonge_tournaments_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("player_id") ON DELETE CASCADE ON UPDATE CASCADE;
