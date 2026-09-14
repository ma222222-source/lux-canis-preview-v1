import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// GET requests only. Never creates customers, products or messages in production.
const base = 'https://lux-canis-preview-v1.pages.dev/';
const checked = new Set();
async function check(file) {
  if (checked.has(file)) return;
  const response = await fetch(new URL(file, base));
  assert.equal(response.status, 200, file);
  const body = await response.text();
  assert.equal(body, readFileSync(new URL('../dist/' + file, import.meta.url), 'utf8'), file + ' differs from build');
  checked.add(file);
  if (file === 'admin.html') {
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
  }
  if (file.endsWith('.html')) {
    for (const match of body.matchAll(/(?:src|href)="\.\/([^"]+\.(?:css|js))"/g)) await check(match[1]);
  }
  console.log('✓ ' + file);
}
for (const file of ['index.html', 'guide.html', 'privacy.html', 'account.html', 'admin.html', 'contact.html', 'product.html', 'sw.js']) await check(file);
for (const [path, expected] of [['api/products', 200], ['api/notices', 200], ['api/admin/users', 401]]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, expected, path);
  console.log('✓ ' + path + ': ' + expected);
}
console.log('Production read-only checks passed.');
