import type { ChatStreamEvent } from '@/lib/chat-types';

/** Decode complete NDJSON events even when network chunks split UTF-8 or lines. */
export async function readChatStream(stream: ReadableStream<Uint8Array>, receive: (event: ChatStreamEvent) => void, signal?: AbortSignal) {
  const reader = stream.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const decoder = new TextDecoder();
  let buffered = '';
  function processLines(final = false) {
    const lines = buffered.split('\n');
    buffered = final ? '' : lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) receive(JSON.parse(line) as ChatStreamEvent);
    }
  }
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffered += decoder.decode(result.value, { stream: true });
      processLines();
    }
    buffered += decoder.decode();
    processLines(true);
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
