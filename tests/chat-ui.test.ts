import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageContent } from '../components/chat/citations';
import { readChatStream } from '../components/chat/stream';
import type { ChatMessage, ChatStreamEvent } from '../lib/chat-types';

const message: ChatMessage = {
  id: 'saved-answer', role: 'assistant', status: 'complete', createdAt: '2026-11-01T10:00:00Z',
  content: 'A supported claim [2]. An unknown marker [9].',
  sources: [
    { number: 1, chunkId: 'unused', documentId: 'doc', documentName: 'Unused document', chunkIndex: 0, content: 'Unused passage' },
    { number: 2, chunkId: 'saved-chunk', documentId: 'doc', documentName: '<script>Report</script>', chunkIndex: 3, content: 'Original text: <img src=x onerror=alert(1)>\nSecond line.' },
  ],
};

test('saved citations render expandable original text and only referenced source numbers', () => {
  const html = renderToStaticMarkup(createElement(MessageContent, { message }));
  assert.match(html, /<details id="source-saved-answer-2"/);
  assert.match(html, /<summary/);
  assert.match(html, /Chunk 4/);
  assert.match(html, /Original text:/);
  assert.match(html, /Second line/);
  assert.match(html, /Read source 2:/);
  assert.ok(!html.includes('Unused document'));
  assert.ok(!html.includes('source-saved-answer-9'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img/);
});

test('unsourced answers do not fabricate a source footnote section', () => {
  const html = renderToStaticMarkup(createElement(MessageContent, { message: { ...message, content: 'Not enough information.', sources: [] } }));
  assert.ok(!html.includes('<details'));
  assert.ok(!html.includes('Cited sources'));
});

test('NDJSON handles split Unicode, split records, blank lines and a final record without newline', async () => {
  const expected: ChatStreamEvent[] = [
    { type: 'delta', messageId: 'answer', text: 'Caf\u00e9 \ud83d\udcc4' },
    { type: 'title', title: 'Document overview' },
  ];
  const bytes = new TextEncoder().encode(expected.map(event => JSON.stringify(event)).join('\n\n'));
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
  const received: ChatStreamEvent[] = [];
  await readChatStream(stream, event => received.push(event));
  assert.deepEqual(received, expected);
  assert.equal(stream.locked, false);
});

test('NDJSON parse errors reject and release the reader lock', async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{invalid}\n')); controller.close(); } });
  await assert.rejects(readChatStream(stream, () => {}), SyntaxError);
  assert.equal(stream.locked, false);
});

test('leaving a conversation cancels its reader and releases the stream', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const controller = new AbortController();
  const reading = readChatStream(stream, () => {}, controller.signal);
  controller.abort();
  await reading;
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
});
