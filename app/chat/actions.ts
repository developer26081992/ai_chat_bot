'use server';

import { handleChat } from '@/lib/chat-handler';

export async function submitChat(form: FormData): Promise<
  { stream: ReadableStream<Uint8Array>; error?: never } |
  { error: string; stream?: never }
> {
  const conversationId = form.get('conversationId');
  const response = await handleChat(new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: form.get('message'),
      ...(conversationId ? { conversationId } : { documentIds: form.getAll('documentIds') }),
    }),
  }));
  if (!response.ok) return { error: (await response.json()).error };
  if (!response.body) return { error: 'No response stream was received.' };
  // React Flight transports the stream while the action's RAG pipeline runs.
  return { stream: response.body };
}
