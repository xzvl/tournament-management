-- Add Challonge OAuth fields to users
ALTER TABLE "users"
  ADD COLUMN "challonge_client_id" TEXT,
  ADD COLUMN "challonge_client_secret" TEXT,
  ADD COLUMN "challonge_redirect_uri" TEXT,
  ADD COLUMN "challonge_access_token" TEXT;
