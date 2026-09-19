-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "videoMetadata" JSONB,
    "telemetrySummary" JSONB,
    "syncReport" JSONB,
    "telemetrySettings" JSONB NOT NULL,
    "overlayConfig" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" REAL NOT NULL,
    "receivedBytes" REAL NOT NULL DEFAULT 0,
    "chunkSize" INTEGER NOT NULL,
    "tempKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Upload_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'EXPORT',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "phase" TEXT,
    "progress" REAL NOT NULL DEFAULT 0,
    "framesDone" INTEGER,
    "framesTotal" INTEGER,
    "settings" JSONB NOT NULL,
    "overlaySnapshot" JSONB NOT NULL,
    "telemetrySettingsSnapshot" JSONB NOT NULL,
    "warnings" JSONB,
    "outputFileId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "logKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "RenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_projectId_role_idx" ON "StoredFile"("projectId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_tempKey_key" ON "Upload"("tempKey");

-- CreateIndex
CREATE INDEX "Upload_projectId_status_idx" ON "Upload"("projectId", "status");

-- CreateIndex
CREATE INDEX "RenderJob_projectId_createdAt_idx" ON "RenderJob"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "RenderJob_status_idx" ON "RenderJob"("status");
