import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
if (output !== join(root, 'dist')) throw new Error('Unexpected output directory.');

const files = [
  '_headers', 'index.html', 'product.html', 'account.html', 'contact.html', 'guide.html', 'privacy.html', 'admin.html',
  'styles.css', 'home-v2.css', 'home-art.css', 'product.css', 'product-enhancements.css', 'account.css', 'account-polish.css', 'account-art.css', 'contact.css', 'guide.css', 'privacy.css', 'admin.css', 'visibility.css',
  'script.js', 'product.js', 'account.js', 'contact.js', 'admin.js', 'sw.js',
  'manifest.webmanifest', 'icon.svg'
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
// Content-based URLs keep older service workers from returning stale CSS/JS.
const versioned = new Map(files.filter((file) => /\.(css|js)$/.test(file) && file !== 'sw.js').map((file) => {
  const hash = createHash('sha256').update(readFileSync(join(root, file))).digest('hex').slice(0, 12);
  return [file, file.replace(/\.(css|js)$/, `.${hash}.$1`)];
}));
for (const file of files) {
  if (file.endsWith('.html') || file === 'sw.js') {
    let content = readFileSync(join(root, file), 'utf8');
    for (const [original, hashed] of versioned) content = content.split(`./${original}`).join(`./${hashed}`);
    writeFileSync(join(output, file), content);
  } else {
    cpSync(join(root, file), join(output, versioned.get(file) || file));
  }
}
cpSync(join(root, 'assets'), join(output, 'assets'), { recursive: true });
console.log(`Built ${files.length} files and assets into dist.`);
