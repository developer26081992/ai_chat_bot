import { getEncoding } from 'js-tiktoken';
const encoder = getEncoding('cl100k_base');
export function chunkText(text: string, size = 500, overlap = 50): string[] {
  if (!Number.isInteger(size) || !Number.isInteger(overlap) || size < 1 || overlap < 0 || overlap >= size) throw new Error('Invalid chunk settings');
  const tokens = encoder.encode(text);
  const chunks: string[] = [];
  for (let start = 0; start < tokens.length; start += size - overlap) {
    const end = Math.min(start + size, tokens.length);
    chunks.push(encoder.decode(tokens.slice(start, end)));
    if (end === tokens.length) break;
  }
  return chunks;
}
