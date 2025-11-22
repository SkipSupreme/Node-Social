-- Step 1: Create the federated_identities table first
CREATE TABLE "federated_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubjectId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federated_identities_pkey" PRIMARY KEY ("id")
);

-- Step 2: Migrate existing Google OAuth data
INSERT INTO "federated_identities" ("id", "userId", "provider", "providerSubjectId", "providerEmail", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    'google',
    "googleId",
    "email",
    "createdAt",
    "createdAt"
FROM "User"
WHERE "googleId" IS NOT NULL;

-- Step 3: Migrate existing Apple OAuth data
INSERT INTO "federated_identities" ("id", "userId", "provider", "providerSubjectId", "providerEmail", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    'apple',
    "appleId",
    "email",
    "createdAt",
    "createdAt"
FROM "User"
WHERE "appleId" IS NOT NULL;

-- Step 4: Create indexes and constraints
CREATE INDEX "federated_identities_provider_providerSubjectId_idx" ON "federated_identities"("provider", "providerSubjectId");
CREATE INDEX "federated_identities_userId_idx" ON "federated_identities"("userId");
CREATE UNIQUE INDEX "federated_identities_provider_providerSubjectId_key" ON "federated_identities"("provider", "providerSubjectId");

-- Step 5: Add foreign key constraint
ALTER TABLE "federated_identities" ADD CONSTRAINT "federated_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Now safe to drop old columns and indexes
DROP INDEX IF EXISTS "User_appleId_key";
DROP INDEX IF EXISTS "User_googleId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "appleId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "googleId";
