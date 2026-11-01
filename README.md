# RAG Chatbot — Part (a)

Next.js 15 App Router, React, Tailwind, Clerk, Prisma, Neon PostgreSQL with pgvector, and Vercel AI SDK with OpenAI.

## Implemented scope

Authenticated PDF/text upload, text extraction, 500-token chunks with 50-token overlap using cl100k_base, text-embedding-3-small embeddings (1536 dimensions), atomic vector storage, and a user-scoped document library. Conversation and Message models are included. Chat generation, retrieval, streaming responses, and history endpoints are future parts of the assignment; they are not implemented in Part (a). Stripe and Supabase are not required for this Neon-based deliverable.

## AI usage declaration

OpenAI Codex assisted with generating the implementation, documentation, and tests. The application sends extracted document chunks to OpenAI to generate embeddings. Review generated code and validate it in your own environment before production deployment.

## Local setup

1. Install Node.js 22 LTS or later and run `npm ci`.
2. Copy `.env.example` to `.env`. Configure a Neon database, a Clerk application, and an OpenAI API key. Never commit secrets. DATABASE_URL is the pooled Neon URL; DIRECT_URL is the direct connection used for migrations. Both must use SSL.
3. Run `npm run db:migrate`. The initial migration executes `CREATE EXTENSION IF NOT EXISTS vector` and creates all four tables and the cosine HNSW index. Your migration database role must have permission to enable the extension. You can also enable it first in the Neon SQL editor.
4. Run `npm run dev`, open http://localhost:3000, sign in, and upload a PDF or .txt file.
5. Run `npm test`, `npm run typecheck`, and `npm run build` to verify the project. Clerk's publishable key must be present at build time.

## API

`POST /api/documents/upload`: authenticated multipart/form-data with a `file` field. Returns HTTP 201 with `{ id, name, createdAt, chunkCount }`. Clerk session cookies are required; clients cannot choose a userId. Accepts files up to 4 MiB, PDFs up to 200 extracted pages, extracted text up to 500,000 characters, and at most 250 chunks. Scanned PDFs need OCR externally. Only UTF-8 text is accepted. Malformed inputs return 4xx; upstream/database failures return a generic 502. Embeddings are generated before the transaction; a database failure leaves no partial document but can still incur OpenAI charges. Retries create a separate document.

`GET /api/documents`: returns the latest 100 documents belonging to the signed-in user, including chunk counts. Content and vectors are not returned.

Vector writes use parameterized Prisma SQL because Prisma does not directly support vector fields. All chunk vectors and the document are committed together. The upload route uses the Node runtime and a 60-second function duration, with a 40-second embedding timeout. These bounded synchronous uploads suit Part (a); larger ingestion workloads need a queue, object storage, OCR workers, and per-user quotas/rate limiting before a broad public rollout. No chat/RAG quality claims have been tested.

## Verify live storage

Upload a short .txt file, then a multi-page text-based PDF. Verify they appear in the library. In Neon SQL editor:

```sql
SELECT extname FROM pg_extension WHERE extname = 'vector';
SELECT d.id, d.name, count(c.id) AS chunks,
       min(vector_dims(c.embedding)) AS dimensions
FROM "Document" d
JOIN "DocumentChunk" c ON c."documentId" = d.id
GROUP BY d.id, d.name;
```

Expect dimensions = 1536 and positive chunk counts. Test signed-out uploads (401), unsupported files (415), unreadable PDFs (422), and oversized uploads (413). Sign in as a second user and confirm their library excludes the first user's uploads. Actual Neon/OpenAI integration requires valid credentials and is not replaced by the unit tests.

## Public GitHub repository and Vercel

The configured remote is https://github.com/developer26081992/ai_chat_bot.git. To publish using your authenticated Git installation:

```powershell
git init
git add .
git commit -m "Implement document ingestion and vector storage"
git branch -M main
git push -u origin main
```

Review staged files before committing and ensure `.env` is ignored. Set repository visibility to Public in GitHub Settings if it is not already public. Import the public GitHub repository in Vercel, select Next.js, and configure all variables from `.env.example` for the appropriate deployment environments. Apply `npm run db:migrate` to Neon before deploying. Use `npm run build` as the build command. Add your production domain to Clerk and use its production keys. Vercel's request-size and function-duration limits apply; 4 MiB is the application's file limit to allow multipart overhead. No GitHub repository or Vercel deployment is created by the source code alone.

Dependencies are sourced from the public npm registry and pinned by package-lock.json. Reference: [OpenAI embeddings API](https://developers.openai.com/api/reference/resources/embeddings/methods/create), [Vercel AI SDK embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings).



## Verification status

Dependency installation was attempted with network access and retried from cache. Registry downloads stalled, and the offline fallback reported missing packages. The chunking test runner was invoked but could not load the missing js-tiktoken dependency; Prisma generation was also blocked by missing dependencies. Type checking was attempted and failed on missing dependency declarations and the ungenerated Prisma client. The production build and live ingestion have not been verified. Run a clean `npm ci` and all checks above in a fully connected environment. Neon extension activation and live storage require the deployment credentials.

