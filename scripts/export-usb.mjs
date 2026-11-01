import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directories = ['app', 'components', 'lib', 'prisma', 'samples', 'scripts', 'tests', 'docs'];
const rootFiles = [
  '.env.example', '.gitignore', '.nvmrc', '.vercelignore', 'README.md', 'START-HERE.txt',
  'package.json', 'package-lock.json', 'middleware.ts', 'next-env.d.ts', 'next.config.ts', 'postcss.config.cjs',
  'tailwind.config.cjs', 'tsconfig.json', 'vercel.json', 'deployment.json',
];

function list(directory) {
  return readdirSync(join(root, directory)).sort().flatMap(name => {
    if (name.startsWith('.env') || ['node_modules', '.git', '.next', 'deliverables'].includes(name)) return [];
    const relativePath = `${directory}/${name}`;
    const stat = lstatSync(join(root, relativePath));
    if (stat.isSymbolicLink()) throw new Error(`Refusing to follow a symlink: ${relativePath}`);
    return stat.isDirectory() ? list(relativePath) : [relativePath];
  });
}

// A small standards-compliant, uncompressed ZIP writer avoids an export dependency.
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const body = [], central = [];
  let offset = 0, centralSize = 0;
  for (const { name, bytes } of entries) {
    const filename = Buffer.from(`ai-chatbot/${name}`, 'utf8');
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    body.push(local, filename, bytes);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x800, 8); record.writeUInt16LE(33, 14); record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(bytes.length, 24);
    record.writeUInt16LE(filename.length, 28); record.writeUInt32LE(offset, 42);
    central.push(record, filename); centralSize += record.length + filename.length;
    offset += local.length + filename.length + bytes.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...body, ...central, end]);
}

const files = [...rootFiles.filter(file => existsSync(join(root, file))), ...directories.filter(directory => existsSync(join(root, directory))).flatMap(list)].sort();
if (files.filter(file => file.endsWith('.pdf')).length < 2) throw new Error('Generate at least two sample PDFs before exporting.');
const parent = join(root, 'deliverables');
mkdirSync(parent, { recursive: true });
const output = mkdtempSync(join(parent, 'ai-chatbot-'));
const manifest = { repositoryUrl: 'https://github.com/developer26081992/ai_chat_bot', files: {} };
const entries = [];
for (const name of files) {
  const bytes = readFileSync(join(root, name));
  const target = join(output, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  manifest.files[name] = createHash('sha256').update(bytes).digest('hex');
  entries.push({ name, bytes });
}
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(output, 'SHA256SUMS.json'), manifestBytes);
entries.push({ name: 'SHA256SUMS.json', bytes: manifestBytes });
const archive = `${output}.zip`;
writeFileSync(archive, zip(entries));
console.log(`Portable source folder: ${output}`);
console.log(`Portable ZIP: ${archive}`);
console.log(`Included ${files.length} files and ${files.filter(file => file.endsWith('.pdf')).length} PDFs. Secrets and node_modules are excluded.`);

if (process.argv[2]) {
  if (process.argv[2] !== '--destination' || !process.argv[3] || process.argv.length !== 4) throw new Error('Usage: npm run export:usb -- --destination "E:\\Submission"');
  const destination = resolve(process.argv[3]);
  if (!existsSync(destination) || !lstatSync(destination).isDirectory()) throw new Error('The destination must be an existing directory.');
  const target = join(destination, basename(output));
  if (existsSync(target)) throw new Error('Destination already exists; no existing files were replaced.');
  cpSync(output, target, { recursive: true, errorOnExist: true, force: false });
  console.log(`Copied portable source to: ${target}`);
}
