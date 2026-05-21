ALTER TABLE "GrenadeEntry" ADD COLUMN "hasMedia" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GrenadeEntry" ADD COLUMN "landingThumb" TEXT;

CREATE TABLE "AnnotationMedia" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "blobKey" TEXT,
    "caption" TEXT,
    "trimStart" DOUBLE PRECISION,
    "trimEnd" DOUBLE PRECISION,
    "cropBox" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnotationMedia_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AnnotationMedia" ADD CONSTRAINT "AnnotationMedia_guideId_fkey"
  FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AnnotationMedia_guideId_nodeId_idx" ON "AnnotationMedia"("guideId", "nodeId");
CREATE INDEX "AnnotationMedia_guideId_idx" ON "AnnotationMedia"("guideId");
