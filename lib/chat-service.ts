import { ChatError, citedSources, cleanCitationMarkers, normalizeTitle, readChatInput, retrievalQuery, type ChatInput } from './chat-domain';
import type { ChatMessage, ChatStreamEvent, ConversationSummary, SourceCitation } from './chat-types';

export type PreparedTurn = {
  conversation: ConversationSummary;
  documentIds: string[];
  assistant: ChatMessage;
  history: ChatMessage[];
  isFirstTurn: boolean;
  generationId: string;
};

export type ChatDependencies = {
  authenticate(): Promise<string | null>;
  configured(): boolean;
  startTurn(userId: string, input: ChatInput): Promise<PreparedTurn>;
  retrieve(userId: string, documentIds: string[], query: string, signal: AbortSignal): Promise<SourceCitation[]>;
  generateTitle(message: string): Promise<string>;
  saveTitle(userId: string, conversationId: string, title: string): Promise<void>;
  streamAnswer(history: ChatMessage[], sources: SourceCitation[], signal: AbortSignal): AsyncIterable<string>;
  finishTurn(turn: PreparedTurn, userId: string, content: string, sources: SourceCitation[], status: 'complete' | 'failed'): Promise<ChatMessage>;
};

export function createChatHandler(deps: ChatDependencies) {
  return async function POST(request: Request): Promise<Response> {
    let userId: string;
    let input: ChatInput;
    let turn: PreparedTurn;
    try {
      const authenticated = await deps.authenticate();
      if (!authenticated) throw new ChatError(401, 'Sign in to start a conversation.');
      userId = authenticated;
      input = await readChatInput(request);
      if (!deps.configured()) throw new ChatError(503, 'The AI service is not configured.');
      turn = await deps.startTurn(userId, input);
    } catch (error) {
      if (error instanceof ChatError) return Response.json({ error: error.message }, { status: error.status });
      console.error('Unable to start chat', { type: error instanceof Error ? error.name : 'UnknownError' });
      return Response.json({ error: 'Unable to start the conversation. Please try again.' }, { status: 503 });
    }

    const cancellation = new AbortController();
    const signal = AbortSignal.any([request.signal, cancellation.signal, AbortSignal.timeout(45000)]);
    let disconnected = false;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function send(event: ChatStreamEvent) {
          if (disconnected) return;
          try { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); }
          catch { disconnected = true; cancellation.abort(); }
        }
        send({ type: 'conversation', conversation: turn.conversation });
        // A separate bounded LLM call runs alongside retrieval and the answer.
        const titlePromise = turn.isFirstTurn ? (async () => {
          try {
            const title = normalizeTitle(await deps.generateTitle(input.message), turn.conversation.title);
            await deps.saveTitle(userId, turn.conversation.id, title);
            send({ type: 'title', title });
          } catch {
            // The six-word fallback was saved when the first message was created.
            // A title-provider failure must not discard an otherwise good answer.
          }
        })() : Promise.resolve();
        let text = '';
        let sources: SourceCitation[] = [];
        try {
          sources = await deps.retrieve(userId, turn.documentIds, retrievalQuery(turn.history), signal);
          send({ type: 'sources', messageId: turn.assistant.id, sources });
          if (sources.length === 0) {
            text = 'I could not find readable source chunks in the selected documents. Please upload a text-based document and start a new conversation.';
            send({ type: 'delta', messageId: turn.assistant.id, text });
          } else {
            for await (const delta of deps.streamAnswer(turn.history, sources, signal)) {
              text += delta;
              send({ type: 'delta', messageId: turn.assistant.id, text: delta });
            }
            if (signal.aborted || !text.trim()) throw new Error('Incomplete answer');
          }
          text = cleanCitationMarkers(text, sources);
          const message = await deps.finishTurn(turn, userId, text, citedSources(text, sources), 'complete');
          await titlePromise;
          // Only acknowledge completion after the content and citation snapshots commit.
          send({ type: 'done', message });
        } catch (error) {
          console.error('Chat reply failed', { type: error instanceof Error ? error.name : 'UnknownError' });
          let saved = false;
          try {
            text = cleanCitationMarkers(text, sources);
            await deps.finishTurn(turn, userId, text, citedSources(text, sources), 'failed');
            saved = true;
          } catch {
            console.error('Unable to save interrupted reply');
          }
          await titlePromise;
          send({ type: 'error', error: saved
            ? 'The reply was interrupted. Your question and any partial answer were saved. Reopen the conversation to continue.'
            : 'The reply could not be saved. Reopen the conversation to check its history before trying again.' });
        } finally {
          if (!disconnected) controller.close();
        }
      },
      cancel() { disconnected = true; cancellation.abort(); },
    });
    return new Response(stream, { headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'X-Accel-Buffering': 'no',
    } });
  };
}
