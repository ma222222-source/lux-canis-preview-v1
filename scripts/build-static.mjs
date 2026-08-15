import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
if (output !== join(root, 'dist')) throw new Error('Unexpected output directory.');

const files = [
  '_headers', 'index.html', 'product.html', 'account.html', 'contact.html', 'admin.html',
  'styles.css', 'product.css', 'account.css', 'account-polish.css', 'contact.css', 'admin.css', 'visibility.css',
  'script.js', 'product.js', 'account.js', 'contact.js', 'admin.js', 'sw.js',
  'manifest.webmanifest', 'icon.svg'
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of files) cpSync(join(root, file), join(output, file));
cpSync(join(root, 'assets'), join(output, 'assets'), { recursive: true });
console.log(`Built ${files.length} files and assets into dist.`);
