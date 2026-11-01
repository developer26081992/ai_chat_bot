import nextEnvironment from '@next/env';
import { pathToFileURL } from 'node:url';

export const requiredVariables = [
  'DATABASE_URL', 'DIRECT_URL', 'OPENAI_API_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY',
];

export function configurationErrors(environment) {
  const errors = [];
  for (const name of requiredVariables) {
    const value = environment[name]?.trim();
    if (!value || /USER:PASSWORD|\bHOST\b|your[-_ ]?(key|secret|password)|CHANGE_ME/i.test(value)) {
      errors.push(`${name} is missing or still contains a placeholder.`);
    }
  }
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    const value = environment[name];
    if (!value || /USER:PASSWORD|\bHOST\b/.test(value)) continue;
    try {
      const url = new URL(value);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) errors.push(`${name} must be a PostgreSQL connection URL.`);
      if (url.hostname.endsWith('.neon.tech') && !['require', 'verify-full'].includes(url.searchParams.get('sslmode'))) {
        errors.push(`${name} must enable SSL for Neon (sslmode=require).`);
      }
      if (name === 'DIRECT_URL' && url.hostname.includes('-pooler.')) errors.push('DIRECT_URL must use the direct Neon host, without -pooler.');
    } catch { errors.push(`${name} is not a valid connection URL.`); }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  nextEnvironment.loadEnvConfig(process.cwd());
  const errors = configurationErrors(process.env);
  if (errors.length) {
    console.error('Deployment configuration is incomplete:\n' + errors.map(error => `- ${error}`).join('\n'));
    console.error('Set these values in .env for local runs, or in Vercel Project Settings > Environment Variables.');
    process.exitCode = 1;
  } else console.log('All required environment variables are configured.');
}
