ALTER TABLE "Conversation"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "documentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "generationId" TEXT,
  ADD COLUMN "generationStartedAt" TIMESTAMP(3);

ALTER TABLE "Message"
  ADD COLUMN "sequence" INTEGER,
  ADD COLUMN "sources" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'complete';

-- Preserve existing history and give every turn a deterministic order.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "conversationId"
    ORDER BY "createdAt", CASE WHEN "role" = 'user' THEN 0 ELSE 1 END, "id"
  )::INTEGER AS position
  FROM "Message"
)
UPDATE "Message" SET "sequence" = ordered.position
FROM ordered WHERE "Message"."id" = ordered."id";

ALTER TABLE "Message" ALTER COLUMN "sequence" SET NOT NULL;
CREATE UNIQUE INDEX "Message_conversationId_sequence_key" ON "Message"("conversationId", "sequence");
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

UPDATE "Conversation" c SET "updatedAt" = GREATEST(c."createdAt", COALESCE(
  (SELECT MAX(m."createdAt") FROM "Message" m WHERE m."conversationId" = c."id"), c."createdAt"
));
