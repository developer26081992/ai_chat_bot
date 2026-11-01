import { auth } from '@clerk/nextjs/server';
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { chunkText } from '@/lib/chunk';
export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Sign in to upload documents.' }, { status: 401 });
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES + 65536) return Response.json({ error: 'Maximum file size is 4 MiB.' }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: 'Expected multipart/form-data.' }, { status: 400 }); }
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Provide a file in the file field.' }, { status: 400 });
  if (!file.size || file.size > MAX_BYTES) return Response.json({ error: 'File must contain 1 byte to 4 MiB.' }, { status: 413 });
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'pdf' && extension !== 'txt') return Response.json({ error: 'Only PDF and UTF-8 .txt files are supported.' }, { status: 415 });
  let content: string;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (extension === 'pdf') {
      if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF');
      const parse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const result = await parse(bytes, { max: 200 });
      if (result.numpages > 200) throw new Error('Too many pages');
      content = result.text;
    } else {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (content.includes('\u0000')) throw new Error('Binary text');
    }
    content = content.replace(/\u0000/g, '').trim();
  } catch { return Response.json({ error: 'Cannot read this file. Use a valid text-based PDF (up to 200 pages) or UTF-8 text.' }, { status: 422 }); }
  if (!content) return Response.json({ error: 'No readable text found. Scanned PDFs need OCR first.' }, { status: 422 });
  if (content.length > 500000) return Response.json({ error: 'Extracted text exceeds 500,000 characters.' }, { status: 413 });
  const chunks = chunkText(content);
  if (chunks.length > 250) return Response.json({ error: 'Document exceeds the 250 chunk limit. Split it into smaller files.' }, { status: 413 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'Embedding service is not configured.' }, { status: 503 });
  try {
    const { embeddings } = await embedMany({
      model: openai.textEmbeddingModel('text-embedding-3-small', { dimensions: 1536 }),
      values: chunks, maxRetries: 2, abortSignal: AbortSignal.timeout(40000),
    });
    if (embeddings.length !== chunks.length || embeddings.some(v => v.length !== 1536 || v.some(n => !Number.isFinite(n)))) throw new Error('Invalid embedding response');
    const document = await db.$transaction(async tx => {
      const doc = await tx.document.create({ data: { userId, name: file.name.slice(0, 255), content } });
      const rows = chunks.map((chunk, index) => Prisma.sql`(${randomUUID()}, ${doc.id}, ${chunk}, ${JSON.stringify(embeddings[index])}::vector, ${index})`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "DocumentChunk" ("id", "documentId", "content", "embedding", "chunkIndex") VALUES ${Prisma.join(rows)}`);
      return doc;
    }, { timeout: 15000 });
    return Response.json({ id: document.id, name: document.name, createdAt: document.createdAt, chunkCount: chunks.length }, { status: 201 });
  } catch (error) {
    console.error('Document ingestion failed', { type: error instanceof Error ? error.name : 'UnknownError' });
    return Response.json({ error: 'Document processing failed. Please retry shortly.' }, { status: 502 });
  }
}

