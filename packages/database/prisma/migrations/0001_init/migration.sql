-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FAN', 'MODERATOR', 'SECURITY', 'ADMIN');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PROCESSING', 'APPROVED', 'FLAGGED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('GOAL', 'CELEBRATION', 'PLAYER', 'CROWD', 'FOUL', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('NORMAL', 'MEDIUM', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MomentStatus" AS ENUM ('PROCESSING', 'PUBLISHED', 'REMOVED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('MEDICAL', 'SECURITY', 'FIRE', 'OVERCROWDING', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'FAN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stadiums" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "stadiums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "home_score" INTEGER NOT NULL DEFAULT 0,
    "away_score" INTEGER NOT NULL DEFAULT 0,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "start_time" TIMESTAMP(3) NOT NULL,
    "stadium_id" TEXT,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "avatar_url" TEXT,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "blob_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "type" "MediaType" NOT NULL,
    "duration" INTEGER,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "section" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "MediaStatus" NOT NULL DEFAULT 'PROCESSING',

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analysis" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "player_ids" TEXT[],
    "severity" "Severity" NOT NULL DEFAULT 'NORMAL',
    "labels" TEXT[],
    "model" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moments" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "player_ids" TEXT[],
    "best_media_id" TEXT,
    "status" "MomentStatus" NOT NULL DEFAULT 'PROCESSING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moment_media" (
    "moment_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "angle_label" TEXT,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "moment_media_pkey" PRIMARY KEY ("moment_id","media_id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "reported_by" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'NORMAL',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "section" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_media" (
    "incident_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,

    CONSTRAINT "incident_media_pkey" PRIMARY KEY ("incident_id","media_id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "moment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analysis_media_id_key" ON "ai_analysis"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_moment_id_user_id_key" ON "reactions"("moment_id", "user_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_stadium_id_fkey" FOREIGN KEY ("stadium_id") REFERENCES "stadiums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analysis" ADD CONSTRAINT "ai_analysis_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moments" ADD CONSTRAINT "moments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moments" ADD CONSTRAINT "moments_best_media_id_fkey" FOREIGN KEY ("best_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moment_media" ADD CONSTRAINT "moment_media_moment_id_fkey" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moment_media" ADD CONSTRAINT "moment_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_media" ADD CONSTRAINT "incident_media_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_media" ADD CONSTRAINT "incident_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_moment_id_fkey" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

