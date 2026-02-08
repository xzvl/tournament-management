-- AlterTable
ALTER TABLE "communities" ADD COLUMN     "main_color" TEXT,
ADD COLUMN     "secondary_color" TEXT,
ADD COLUMN     "socmed_urls" JSONB;
