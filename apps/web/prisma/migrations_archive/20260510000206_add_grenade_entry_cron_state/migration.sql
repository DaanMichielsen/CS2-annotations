-- CreateTable
CREATE TABLE "GrenadeEntry" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "map" TEXT NOT NULL,
    "grenadeType" TEXT NOT NULL,
    "throwType" TEXT NOT NULL,
    "posLabel" TEXT,
    "aimLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrenadeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrenadeEntry_guideId_nodeId_key" ON "GrenadeEntry"("guideId", "nodeId");

-- CreateIndex
CREATE INDEX "GrenadeEntry_map_idx" ON "GrenadeEntry"("map");

-- CreateIndex
CREATE INDEX "GrenadeEntry_throwType_idx" ON "GrenadeEntry"("throwType");

-- CreateIndex
CREATE INDEX "GrenadeEntry_grenadeType_idx" ON "GrenadeEntry"("grenadeType");

-- AddForeignKey
ALTER TABLE "GrenadeEntry" ADD CONSTRAINT "GrenadeEntry_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
