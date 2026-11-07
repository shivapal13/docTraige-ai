-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "UrgencyTier" AS ENUM ('STAT', 'URGENT', 'ROUTINE');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "status" "DocumentStatus" NOT NULL DEFAULT 'QUEUED',
    "urgency" "UrgencyTier" NOT NULL DEFAULT 'ROUTINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_results" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "patientName" TEXT,
    "mrn" TEXT,
    "dob" TEXT,
    "documentType" TEXT,
    "rawText" TEXT NOT NULL,
    "extractedLabValues" JSONB,
    "flaggedPhrases" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_matches" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "foundValue" TEXT NOT NULL,
    "threshold" TEXT NOT NULL,
    "severity" "UrgencyTier" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extraction_results_documentId_key" ON "extraction_results"("documentId");

-- AddForeignKey
ALTER TABLE "extraction_results" ADD CONSTRAINT "extraction_results_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_matches" ADD CONSTRAINT "rule_matches_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
