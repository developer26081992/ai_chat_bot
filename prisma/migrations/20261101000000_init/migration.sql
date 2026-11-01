CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "Document" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "content" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "DocumentChunk" (
 "id" TEXT PRIMARY KEY, "documentId" TEXT NOT NULL, "content" TEXT NOT NULL,
 "embedding" vector(1536) NOT NULL, "chunkIndex" INTEGER NOT NULL,
 CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Conversation" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Message" (
 "id" TEXT PRIMARY KEY, "conversationId" TEXT NOT NULL, "role" TEXT NOT NULL,
 "content" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Document_userId_createdAt_idx" ON "Document"("userId", "createdAt");
CREATE UNIQUE INDEX "DocumentChunk_documentId_chunkIndex_key" ON "DocumentChunk"("documentId", "chunkIndex");
CREATE INDEX "Conversation_userId_createdAt_idx" ON "Conversation"("userId", "createdAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "DocumentChunk_embedding_idx" ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops);
