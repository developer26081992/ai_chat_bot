import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const url = new URL(process.argv[2]);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Provide the HTTPS application origin without credentials, a path, or query parameters.');
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  if (!response.ok || !html.includes('Knowledge starts here.')) throw new Error('The URL did not return the public chatbot home page. Check deployment status and Vercel deployment protection.');
  const deployment = JSON.parse(readFileSync(join(root, 'deployment.json'), 'utf8'));
  deployment.liveUrl = url.origin;
  deployment.verifiedAt = new Date().toISOString();
  const readmePath = join(root, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const marker = /<!-- LIVE_URL_START -->[\s\S]*?<!-- LIVE_URL_END -->/;
  if (!marker.test(readme)) throw new Error('README live-URL markers are missing.');
  writeFileSync(readmePath, readme.replace(marker, `<!-- LIVE_URL_START -->\n**Live URL:** [Open the chatbot](<${url.origin}>)\n<!-- LIVE_URL_END -->`));
  writeFileSync(join(root, 'deployment.json'), JSON.stringify(deployment, null, 2) + '\n');
  console.log(`Verified and recorded live URL: ${url.origin}`);
} catch (error) {
  console.error(`Live deployment not recorded: ${error.message}`);
  process.exitCode = 1;
}
