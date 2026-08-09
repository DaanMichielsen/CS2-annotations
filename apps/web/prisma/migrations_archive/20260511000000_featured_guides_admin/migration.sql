-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedGuide" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturedGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideCredit" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "label" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GuideCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedGuide_guideId_key" ON "FeaturedGuide"("guideId");

-- CreateIndex
CREATE INDEX "FeaturedGuide_position_idx" ON "FeaturedGuide"("position");

-- CreateIndex
CREATE INDEX "GuideCredit_guideId_idx" ON "GuideCredit"("guideId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedGuide" ADD CONSTRAINT "FeaturedGuide_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideCredit" ADD CONSTRAINT "GuideCredit_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
