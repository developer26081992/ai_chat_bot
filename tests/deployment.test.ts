import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import parse from 'pdf-parse/lib/pdf-parse.js';
import { configurationErrors } from '../scripts/check-env.mjs';
import { chunkText } from '../lib/chunk';

const configured = {
  DATABASE_URL: 'postgresql://tester:example@ep-demo-pooler.neon.tech/test?sslmode=require',
  DIRECT_URL: 'postgresql://tester:example@ep-demo.neon.tech/test?sslmode=require',
  OPENAI_API_KEY: 'test-only-value',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_sample',
  CLERK_SECRET_KEY: 'sk_test_sample',
};

test('deployment preflight accepts separate SSL pooled/direct Neon connections', () => {
  assert.deepEqual(configurationErrors(configured), []);
});

test('deployment preflight rejects placeholders, pooled migration URLs and missing Neon SSL', () => {
  assert.ok(configurationErrors({}).some(error => error.includes('OPENAI_API_KEY')));
  assert.ok(configurationErrors({ ...configured, DIRECT_URL: configured.DATABASE_URL }).some(error => error.includes('without -pooler')));
  assert.ok(configurationErrors({ ...configured, DATABASE_URL: configured.DATABASE_URL.replace('?sslmode=require', '') }).some(error => error.includes('enable SSL')));
  assert.ok(configurationErrors({ ...configured, DIRECT_URL: 'postgresql://USER:PASSWORD@HOST.neon.tech/DB' }).some(error => error.includes('placeholder')));
});

test('deployment errors name variables without disclosing their values', () => {
  const secret = 'do-not-log-this-test-value';
  const errors = configurationErrors({ ...configured, DIRECT_URL: secret });
  assert.ok(errors.some(error => error.includes('DIRECT_URL')));
  assert.ok(!errors.join('\n').includes(secret));
});

test('both sample PDFs contain readable source facts and exercise multiple chunks', async () => {
  for (const [name, expected] of [
    ['riverbend-operations', ['RB-204', '08:30', 'seven calendar days']],
    ['riverbend-product-faq', ['R120', 'R350', '14 calendar days']],
  ] as const) {
    const bytes = readFileSync(resolve('samples', `${name}.pdf`));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    const pdf = await parse(bytes);
    assert.equal(pdf.numpages, 2);
    for (const fact of expected) assert.ok(pdf.text.includes(fact), `Missing sample fact: ${fact}`);
    assert.ok(chunkText(pdf.text).length > 1);
  }
});
