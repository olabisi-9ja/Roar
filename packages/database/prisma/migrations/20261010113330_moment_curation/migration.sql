-- AlterTable
ALTER TABLE "moments" ADD COLUMN     "minute" INTEGER,
ADD COLUMN     "promoted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'editor';
