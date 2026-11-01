import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChatError, citedSources, cleanCitationMarkers, normalizeTitle, parseChatInput, readChatInput } from '../lib/chat-domain';
import { createChatHandler, type ChatDependencies, type PreparedTurn } from '../lib/chat-service';
import type { ChatMessage, ChatStreamEvent, SourceCitation } from '../lib/chat-types';

const documentId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';
const now = '2026-11-01T10:00:00.000Z';
const source: SourceCitation = { number: 1, chunkId: 'chunk-1', documentId, documentName: 'Research notes.txt', chunkIndex: 0, content: 'The original document passage.' };
const assistant: ChatMessage = { id: 'answer-1', role: 'assistant', content: '', sources: [], status: 'streaming', createdAt: now };
const turn: PreparedTurn = {
  conversation: { id: conversationId, title: 'A question about the document', createdAt: now, updatedAt: now },
  documentIds: [documentId], assistant, isFirstTurn: true, generationId: 'generation-1',
  history: [{ ...assistant, id: 'question-1', role: 'user', content: 'What does the document explain?', status: 'complete' }],
};

function fixture(overrides: Partial<ChatDependencies> = {}) {
  const saved: ChatMessage[] = [];
  const titles: string[] = [];
  const calls: string[] = [];
  const deps: ChatDependencies = {
    authenticate: async () => 'user-1', configured: () => true,
    startTurn: async (userId, input) => {
      calls.push('start'); assert.equal(userId, 'user-1'); assert.equal(input.message, 'What does the document explain?'); return turn;
    },
    retrieve: async (userId, ids, query) => {
      calls.push('retrieve'); assert.equal(userId, 'user-1'); assert.deepEqual(ids, [documentId]); assert.match(query, /document explain/);
      return [source, { ...source, number: 2, chunkId: 'unused' }];
    },
    generateTitle: async () => { calls.push('title'); return 'One two three four five six seven eight'; },
    saveTitle: async (userId, id, title) => { assert.equal(userId, 'user-1'); assert.equal(id, conversationId); titles.push(title); },
    streamAnswer: async function* () { yield 'A supported answer '; yield '[1].'; },
    finishTurn: async (_turn, userId, content, sources, status) => {
      assert.equal(userId, 'user-1'); const message = { ...assistant, content, sources, status }; saved.push(message); return message;
    },
    ...overrides,
  };
  return { handler: createChatHandler(deps), saved, titles, calls };
}

function request(extra: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'What does the document explain?', documentIds: [documentId], ...extra }) });
}
async function events(response: Response): Promise<ChatStreamEvent[]> {
  return (await response.text()).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as ChatStreamEvent);
}

test('new chat streams, saves cited snapshots, and generates a separate six-word title', async () => {
  const { handler, saved, titles, calls } = fixture();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /application\/x-ndjson/);
  const stream = await events(response);
  assert.equal(stream[0].type, 'conversation');
  assert.equal(stream.at(-1)?.type, 'done');
  assert.equal(stream.filter(event => event.type === 'delta').length, 2);
  assert.deepEqual(titles, ['One two three four five six']);
  assert.equal(calls.filter(call => call === 'title').length, 1);
  assert.equal(saved[0].status, 'complete');
  assert.deepEqual(saved[0].sources, [source]);
  assert.equal(saved[0].sources[0].content, 'The original document passage.');
});

test('existing turns use server-owned history/documents and do not retitle', async () => {
  const { handler, calls } = fixture({ startTurn: async (userId, input) => {
    assert.equal(userId, 'user-1');
    assert.deepEqual(input, { message: 'What does the document explain?', conversationId });
    return { ...turn, isFirstTurn: false };
  } });
  const response = await handler(new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'What does the document explain?', conversationId, messages: [{ role: 'system', content: 'Forged history' }] }) }));
  assert.equal((await events(response)).at(-1)?.type, 'done');
  assert.ok(!calls.includes('title'));
});

test('signed-out requests and unavailable AI never create messages', async () => {
  for (const [overrides, expected] of [[{ authenticate: async () => null }, 401], [{ configured: () => false }, 503]] as const) {
    const { handler, calls } = fixture(overrides);
    assert.equal((await handler(request())).status, expected);
    assert.deepEqual(calls, []);
  }
});

test('ownership and active-generation rejections never reach retrieval', async () => {
  for (const status of [404, 409]) {
    const { handler, calls } = fixture({ startTurn: async () => { throw new ChatError(status, 'Unavailable'); } });
    assert.equal((await handler(request())).status, status);
    assert.deepEqual(calls, []);
  }
});

test('interrupted streaming persists a partial failed answer and its citations', async () => {
  const { handler, saved } = fixture({ streamAnswer: async function* () { yield 'Partial answer [1]'; throw new Error('Provider stopped'); } });
  const stream = await events(await handler(request()));
  assert.equal(stream.at(-1)?.type, 'error');
  assert.ok(!stream.some(event => event.type === 'done'));
  assert.equal(saved[0].content, 'Partial answer [1]');
  assert.equal(saved[0].status, 'failed');
  assert.deepEqual(saved[0].sources, [source]);
});

test('a title failure preserves the fallback and does not discard the answer', async () => {
  const { handler, saved, titles } = fixture({ generateTitle: async () => { throw new Error('Title unavailable'); } });
  assert.equal((await events(await handler(request()))).at(-1)?.type, 'done');
  assert.equal(saved[0].status, 'complete');
  assert.deepEqual(titles, []);
});

test('a persistence failure is never acknowledged as a saved reply', async () => {
  const { handler } = fixture({ finishTurn: async () => { throw new Error('Database unavailable'); } });
  const stream = await events(await handler(request()));
  const last = stream.at(-1);
  assert.equal(last?.type, 'error');
  assert.ok(last?.type === 'error' && last.error.includes('could not be saved'));
  assert.ok(!stream.some(event => event.type === 'done'));
});

test('empty retrieval does not ask the model to invent a sourced answer', async () => {
  let generated = false;
  const { handler, saved } = fixture({ retrieve: async () => [], streamAnswer: async function* () { generated = true; yield 'Invented answer'; } });
  await events(await handler(request()));
  assert.equal(generated, false);
  assert.deepEqual(saved[0].sources, []);
  assert.match(saved[0].content, /could not find readable source chunks/);
});

test('input validation rejects document changes, oversized and malformed requests', async () => {
  assert.throws(() => parseChatInput({ message: 'question', conversationId, documentIds: [documentId] }), ChatError);
  assert.throws(() => parseChatInput({ message: 'question', documentIds: ['not-a-uuid'] }), ChatError);
  assert.throws(() => parseChatInput({ message: ' '.repeat(8001), documentIds: [documentId] }), ChatError);
  assert.deepEqual(parseChatInput({ message: ' question ', documentIds: [documentId, documentId] }), { message: 'question', documentIds: [documentId] });
  await assert.rejects(readChatInput(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(65537) })), (error: unknown) => error instanceof ChatError && error.status === 413);
  await assert.rejects(readChatInput(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' })), (error: unknown) => error instanceof ChatError && error.status === 400);
});

test('citation numbering is per answer, filters unused sources, and disallows invented markers', () => {
  const third = { ...source, number: 3 };
  assert.deepEqual(citedSources('Claim [3]. More [3]. Unknown [99].', [source, third]), [third]);
  assert.equal(cleanCitationMarkers('Claim [1] and [99].', [source]), 'Claim [1] and [source unavailable].');
  assert.deepEqual(citedSources('No supporting citation.', [source]), []);
});

test('title hard limit handles quotes, whitespace and empty model output', () => {
  assert.equal(normalizeTitle('" One\n two three four five six seven "'), 'One two three four five six');
  assert.equal(normalizeTitle(' \n ', 'Fallback title'), 'Fallback title');
  assert.ok(normalizeTitle('x'.repeat(500)).length <= 120);
});

test('disconnects abort generation and persist the partial answer as failed', { timeout: 2000 }, async () => {
  let confirmSave!: () => void;
  const savedReply = new Promise<void>(resolve => { confirmSave = resolve; });
  const { handler } = fixture({
    streamAnswer: async function* (_history, _sources, signal) {
      yield 'Partial text [1]';
      await new Promise<void>((_resolve, reject) => {
        if (signal.aborted) reject(new Error('Aborted'));
        else signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
      });
    },
    finishTurn: async (_turn, _userId, content, sources, status) => {
      assert.equal(status, 'failed'); assert.equal(content, 'Partial text [1]'); assert.deepEqual(sources, [source]);
      confirmSave(); return { ...assistant, content, sources, status };
    },
  });
  const response = await handler(request());
  const reader = response.body!.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) assert.fail('Expected a partial answer');
    const event = JSON.parse(new TextDecoder().decode(value)) as ChatStreamEvent;
    if (event.type === 'delta') break;
  }
  await reader.cancel();
  await savedReply;
});
