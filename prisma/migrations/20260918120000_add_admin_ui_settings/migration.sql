-- CreateTable
CREATE TABLE "AdminUiSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "hiddenModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "advancedReports" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUiSettings_pkey" PRIMARY KEY ("id")
);
