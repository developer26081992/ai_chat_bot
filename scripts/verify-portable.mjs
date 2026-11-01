import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'SHA256SUMS.json');
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let count = 0;
  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    const path = resolve(root, relativePath);
    if (!path.startsWith(root + sep)) throw new Error('Invalid manifest path.');
    const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (actual !== expected) throw new Error(`Checksum mismatch: ${relativePath}`);
    count++;
  }
  console.log(`Verified ${count} source and sample files.`);
} catch (error) {
  console.error(`Portable-copy verification failed: ${error.message}`);
  process.exitCode = 1;
}
