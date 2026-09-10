import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual page scripts with controlled network responses.
// This deliberately never connects to a server or creates real account data.
class Element {
  constructor() {
    this.attrs = {}; this.events = {}; this.dataset = {}; this.value = '';
    this.checked = false; this.disabled = false; this.hidden = false;
    this.textContent = ''; this.innerHTML = ''; this.type = 'text';
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
  async fire(name) {
    for (const callback of this.events[name] || []) await callback({ preventDefault() {}, currentTarget: this, target: this });
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  focus() { this.focused = true; }
  scrollIntoView() {}
  setCustomValidity(message) { this.validationMessage = message; }
  checkValidity() { return !this.validationMessage; }
  reportValidity() {}
  reset() {}
  append() {}
  replaceChildren() {}
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
}
const response = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });
const tick = () => new Promise(resolve => setImmediate(resolve));

function page(filename, fetch, search = '') {
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  const groups = new Map();
  const context = vm.createContext({
    document: { querySelector: get, querySelectorAll: selector => groups.get(selector) || [], createElement: () => new Element(), body: new Element() },
    window: { addEventListener() {} }, history: { replaceState() {} },
    location: { origin: 'https://test.example', pathname: '/account', search, hash: '', assign(value) { this.assigned = value; } },
    URL, URLSearchParams, fetch, setTimeout: () => 1, clearTimeout() {},
    matchMedia: () => ({ matches: true }), console,
  });
  return { get, groups, context, run: () => vm.runInContext(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), context) };
}

let failLogout = false;
let releaseAuth;
const account = page('account.js', async (url) => {
  if (url === '/api/auth/me') return response({ user: { name: '確認', preferences: {} } });
  if (url === '/api/notices') return response({ error: { message: 'offline' } }, false, 503);
  if (url === '/api/restock') return response({ requests: [] });
  if (url === '/api/auth/logout' && failLogout) throw new Error('offline');
  if (url === '/api/auth/register') return new Promise(resolve => { releaseAuth = resolve; });
  return response({});
});
const register = new Element(); register.dataset.auth = 'register';
const login = new Element(); login.dataset.auth = 'login';
account.groups.set('[data-auth]', [register, login]);
account.run(); await tick(); await tick();
assert.equal(account.get('#signed-in').hidden, false, 'notices failure must not hide logged-in account');
assert.match(account.get('#notice-list').innerHTML, /もう一度読み込む/);
console.log('✓ お知らせ失敗でもログインを維持し、再読み込みを案内');

failLogout = true;
await account.get('#logout-button').fire('click');
assert.equal(account.get('#signed-in').hidden, false);
assert.match(account.get('#toast').textContent, /ログアウトできませんでした/);
assert.equal(account.get('#logout-button').disabled, false);
console.log('✓ ログアウトの通信失敗を成功扱いしない');

account.get('#privacy-consent').checked = true;
account.get('#account-password').value = account.get('#account-password-confirm').value = 'example-password';
const signingIn = account.get('#account-form').fire('submit');
assert.equal(register.disabled, true); assert.equal(login.disabled, true);
await login.fire('click');
assert.equal(vm.runInContext('authMode', account.context), 'register');
releaseAuth(response({ user: { name: '確認', preferences: {} } }));
await signingIn;
assert.equal(register.disabled, false);
assert.equal(account.get('#account-password').type, 'password');
console.log('✓ 登録処理中のモード変更を防ぎ、完了後はパスワードを隠す');

for (const [next, allowed] of [
  ['/product.html?id=tiny-drop&color=Blue', true],
  ['https://evil.example/product.html?id=a', false],
  ['//evil.example/product?id=a', false],
  ['/admin.html', false], ['/product.html', false],
]) {
  account.context.location.search = `?next=${encodeURIComponent(next)}`;
  account.context.location.assigned = undefined;
  assert.equal(vm.runInContext('returnToProduct()', account.context), allowed);
  if (allowed) assert.equal(account.context.location.assigned, next);
}
console.log('✓ ログイン後は商品とカラーへ戻り、外部URLには移動しない');

let contactRequests = 0; let releaseContact;
const contact = page('contact.js', () => {
  contactRequests++;
  return new Promise(resolve => { releaseContact = resolve; });
});
const fields = ['name', 'email', 'type', 'message'].map(name => {
  const field = new Element(); field.name = name; field.type = name === 'email' ? 'email' : 'text';
  const error = new Element(); field.closest = () => ({ querySelector: () => error });
  field.error = error;
  return field;
});
const form = contact.get('#contact-form');
form.querySelectorAll = () => fields;
form.querySelector = selector => selector === '[name="name"]' ? fields[0] : contact.get(selector);
contact.context.FormData = class {
  forEach(callback) { fields.forEach(field => callback(field.value, field.name)); }
  *[Symbol.iterator]() { for (const field of fields) yield [field.name, field.value]; }
};
contact.run();
fields.forEach(field => { field.value = '   '; });
await form.fire('submit');
assert.equal(contactRequests, 0);
assert.equal(fields[0].focused, true);
assert.equal(fields[0].getAttribute('aria-invalid'), 'true');
assert.equal(fields[0].getAttribute('aria-describedby'), 'contact-name-error');
console.log('✓ 空白入力を拒否し、エラーの項目へフォーカス');

fields.forEach(field => { field.value = field.name === 'email' ? 'test@example.com' : '確認'; });
await form.fire('submit');
assert.equal(contactRequests, 0);
assert.equal(contact.get('[data-step-label="confirm"]').getAttribute('aria-current'), 'step');
assert.equal(contact.get('#step-confirm h2').focused, true);
console.log('✓ Enterでも直接送らず、確認画面へ移動');

const sending = form.fire('submit');
assert.equal(contact.get('[type="submit"]').disabled, true);
assert.equal(contact.get('[data-back]').disabled, true);
await form.fire('submit'); await contact.get('[data-back]').fire('click');
assert.equal(contactRequests, 1);
releaseContact(response({ error: { message: '一時的なエラー' } }, false, 503));
await sending;
assert.equal(contact.get('[data-back]').disabled, false);
assert.equal(fields[0].value, '確認');
assert.match(contact.get('#contact-submit-error').textContent, /入力内容は残っています/);
console.log('✓ 二重送信と送信中の編集を防ぎ、失敗後の入力を保持');

let releaseRestock; let restockRequests = 0; let requestBody;
const product = page('product.js', async (url, options) => {
  if (url === '/api/restock') {
    restockRequests++; requestBody = JSON.parse(options.body);
    return new Promise(resolve => { releaseRestock = resolve; });
  }
  return response({ product: { id: 'tiny-drop', name: '小さな雫', status: 'sold', images: ['/one.webp', '/two.webp'], variants: [{ name: 'Pink', image: '/one.webp' }, { name: 'Blue', image: '/two.webp' }] } });
}, '?id=tiny-drop&color=Blue');
product.context.location.href = 'https://test.example/product.html?id=tiny-drop&color=Blue';
product.context.location.pathname = '/product.html';
product.run(); await tick();
assert.equal(product.get('#detail-image').src, '/two.webp');
assert.equal(product.get('#detail-image').alt, '小さな雫 Blueの商品写真');
await product.get('#detail-image').fire('error');
assert.equal(product.get('#detail-image').hidden, true);
assert.equal(product.get('#image-error').hidden, false);
console.log('✓ 商品カラーを復元し、写真の読込失敗を案内');

const requestingRestock = product.get('#restock-action').fire('click');
assert.equal(product.get('#restock-action').disabled, true);
await product.get('#restock-action').fire('click');
assert.equal(restockRequests, 1);
assert.equal(requestBody.color, 'Blue');
releaseRestock(response({ error: { message: 'ログインが必要です' } }, false, 401));
await requestingRestock;
assert.match(product.context.location.href, /account\.html\?next=/);
assert.match(decodeURIComponent(product.context.location.href), /color=Blue/);
console.log('✓ 再販登録の連打を防ぎ、ログインへの移動でもカラーを保持');
console.log('Frontend regression tests passed.');
