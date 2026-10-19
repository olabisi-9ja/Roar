-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "ai_status" "AiStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "ai_error" TEXT,
ADD COLUMN     "ai_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ai_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ai_analysis" ADD COLUMN     "safety_relevant" BOOLEAN NOT NULL DEFAULT false;
