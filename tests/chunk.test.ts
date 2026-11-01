import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEncoding } from 'js-tiktoken';
import { chunkText } from '../lib/chunk';
const encoder = getEncoding('cl100k_base');
test('empty and short documents', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText('A short document.'), ['A short document.']);
});
test('500-token windows preserve 50-token overlap and final content', () => {
  const text = 'hello '.repeat(1300);
  const tokens = encoder.encode(text);
  const chunks = chunkText(text);
  assert.equal(chunks.length, 3);
  for (let i = 0; i < chunks.length; i++) {
    assert.equal(chunks[i], encoder.decode(tokens.slice(i * 450, i * 450 + 500)));
  }
  assert.deepEqual(encoder.encode(chunks[0]).slice(-50), encoder.encode(chunks[1]).slice(0, 50));
});
test('exactly one window does not produce redundant overlap', () => {
  assert.equal(chunkText('hello '.repeat(499).trim()).length, 1);
});
test('rejects invalid settings', () => {
  assert.throws(() => chunkText('text', 50, 50));
  assert.throws(() => chunkText('text', 0));
});
