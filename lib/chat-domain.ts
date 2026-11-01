import type { ChatMessage, SourceCitation } from './chat-types';

export class ChatError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ChatError';
  }
}

export type ChatInput = { message: string; conversationId?: string; documentIds?: string[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseChatInput(value: unknown): ChatInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ChatError(400, 'Expected a JSON object.');
  const input = value as Record<string, unknown>;
  if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 8000) {
    throw new ChatError(400, 'Enter a message between 1 and 8,000 characters.');
  }
  if (input.conversationId !== undefined) {
    if (typeof input.conversationId !== 'string' || !uuid.test(input.conversationId)) throw new ChatError(400, 'Invalid conversation ID.');
    if (input.documentIds !== undefined) throw new ChatError(400, 'Documents are fixed for an existing conversation.');
    return { message: input.message.trim(), conversationId: input.conversationId };
  }
  if (!Array.isArray(input.documentIds) || input.documentIds.length < 1 || input.documentIds.length > 10 ||
      input.documentIds.some(id => typeof id !== 'string' || !uuid.test(id))) {
    throw new ChatError(400, 'Select between 1 and 10 documents.');
  }
  return { message: input.message.trim(), documentIds: [...new Set(input.documentIds as string[])] };
}

export async function readChatInput(request: Request): Promise<ChatInput> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ChatError(415, 'Expected application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError(400, 'A request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new ChatError(413, 'Request body is too large.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return parseChatInput(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError(400, 'Invalid JSON request.');
  } finally { reader.releaseLock(); }
}

/** The hard limit is enforced even if the title model ignores its instructions. */
export function normalizeTitle(value: string, fallback = 'New conversation'): string {
  const text = value.replace(/[\r\n]+/g, ' ').replace(/^[\s"'`#]+|[\s"'`]+$/g, '').replace(/\s+/g, ' ').trim();
  return text.split(' ').filter(Boolean).slice(0, 6).join(' ').slice(0, 120).trim() || fallback;
}

export function parseSources(value: unknown): SourceCitation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SourceCitation => {
    if (!item || typeof item !== 'object') return false;
    return Number.isInteger(item.number) && item.number > 0 && Number.isInteger(item.chunkIndex) && item.chunkIndex >= 0 &&
      ['chunkId', 'documentId', 'documentName', 'content'].every(key => typeof item[key] === 'string');
  });
}

export function citedSources(content: string, candidates: SourceCitation[]): SourceCitation[] {
  const numbers = new Set([...content.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1])));
  return candidates.filter(source => numbers.has(source.number));
}

export function cleanCitationMarkers(content: string, sources: SourceCitation[]): string {
  const valid = new Set(sources.map(source => source.number));
  return content.replace(/\[(\d+)\]/g, (marker, number: string) => valid.has(Number(number)) ? marker : '[source unavailable]');
}

export function retrievalQuery(history: ChatMessage[]): string {
  return history.filter(message => message.role === 'user').slice(-2).map(message => message.content).join('\n').slice(-12000);
}
