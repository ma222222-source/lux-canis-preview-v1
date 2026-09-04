const base = process.env.BASE_URL || 'http://127.0.0.1:8788';
let adminCookie = '';
let userCookie = '';

function cookieFrom(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

async function call(path, { method = 'GET', body, cookie = '', form } = {}) {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: form ? { cookie } : { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const publicProducts = await call('products');
ok(publicProducts.response.ok && publicProducts.data.products.length >= 6, '公開商品を取得');

const wrongAdmin = await call('admin/login', { method: 'POST', body: { password: '9999' } });
ok(wrongAdmin.response.status === 401, '誤った管理者パスワードを拒否');
const adminLogin = await call('admin/login', { method: 'POST', body: { password: '0000' } });
adminCookie = cookieFrom(adminLogin.response);
ok(adminLogin.response.ok && adminCookie.startsWith('lux_admin_session='), '管理者ログイン');
ok((await call('admin/overview', { cookie: adminCookie })).response.ok, '管理ダッシュボードを取得');
const staleProducts = (await call('products?admin=1', { cookie: adminCookie })).data.products.filter((item) => item.name.startsWith('動作確認商品'));
for (const item of staleProducts) await call(`products/${item.id}`, { method: 'DELETE', cookie: adminCookie, body: {} });
ok(true, '前回中断した動作確認商品を整理');

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const uploadForm = new FormData();
uploadForm.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
const upload = await call('images', { method: 'POST', cookie: adminCookie, form: uploadForm });
ok(upload.response.status === 201 && upload.data.url, '商品写真をアップロード');
ok((await fetch(`${base}${upload.data.url}`)).ok, 'アップロード画像を取得');

const created = await call('products', { method: 'POST', cookie: adminCookie, body: { name: '動作確認商品', price: 1980, stockQuantity: 2, category: 'charm', variants: [{ name: 'Test', image: upload.data.url }], material: 'Test', fitting: 'Test', description: 'Smoke test', status: 'available', published: true, images: [upload.data.url], sortOrder: 9999 } });
ok(created.response.status === 201, '商品を追加');
const productId = created.data.product.id;
ok(created.data.product.variants[0].image === upload.data.url && created.data.product.stockQuantity === 2 && created.data.product.category === 'charm', 'カラー写真・在庫数・チャームカテゴリを保存');
const updated = await call(`products/${productId}`, { method: 'PUT', cookie: adminCookie, body: { ...created.data.product, name: '動作確認商品 更新済み', images: [] } });
ok(updated.response.ok && updated.data.product.name.includes('更新済み'), '商品を編集');
ok((await fetch(`${base}${upload.data.url}`)).status === 404, '削除した商品写真を画像保存から除去');

const email = `smoke-${Date.now()}@example.com`;
const withoutConsent = await call('auth/register', { method: 'POST', body: { name: '動作確認会員', email, password: 'test-pass-1234' } });
ok(withoutConsent.response.status === 400 && withoutConsent.data.error?.code === 'PRIVACY_CONSENT_REQUIRED', '同意なしの会員登録を拒否');
const registered = await call('auth/register', { method: 'POST', body: { name: '動作確認会員', email, password: 'test-pass-1234', privacyConsent: true } });
userCookie = cookieFrom(registered.response);
ok(registered.response.status === 201 && userCookie.startsWith('lux_session='), '会員登録とログイン');
ok((await call('auth/me', { cookie: userCookie })).data.user?.email === email, 'ログイン状態を取得');
ok((await call('auth/preferences', { method: 'PUT', cookie: userCookie, body: { newItems: true, restock: true, newColors: false, email: false } })).response.ok, '通知設定を保存');

const restock = await call('restock', { method: 'POST', cookie: userCookie, body: { productId, color: 'Test' } });
ok(restock.response.status === 201, '再販待ちを登録');
ok((await call('restock', { cookie: userCookie })).data.requests.length >= 1, '再販待ち一覧を取得');
ok((await call(`restock/${restock.data.id}`, { method: 'DELETE', cookie: userCookie, body: {} })).response.ok, '再販待ちを解除');

const contact = await call('contacts', { method: 'POST', cookie: userCookie, body: { name: '動作確認会員', email, type: '商品について', message: '自動動作確認です。' } });
ok(contact.response.status === 201, '問い合わせを送信');
ok((await call('contacts', { cookie: adminCookie })).data.contacts.some((item) => item.id === contact.data.id), '管理画面で問い合わせを取得');

const notice = await call('notices', { method: 'POST', cookie: adminCookie, body: { type: 'news', title: '動作確認のお知らせ', body: '自動テストです。', productId, published: true } });
ok(notice.response.status === 201, 'お知らせを追加');
ok((await call('notices')).data.notices.some((item) => item.id === notice.data.id), '公開お知らせへ反映');
ok((await call(`notices/${notice.data.id}`, { method: 'PUT', cookie: adminCookie, body: { type: 'restock', title: '更新したお知らせ', body: '編集テストです。', productId, published: true } })).response.ok, 'お知らせを編集');
ok((await call('notices')).data.notices.some((item) => item.id === notice.data.id && item.title === '更新したお知らせ' && item.type === 'restock'), '編集したお知らせを公開反映');
ok((await call(`notices/${notice.data.id}`, { method: 'DELETE', cookie: adminCookie, body: {} })).response.ok, 'お知らせを削除');
ok((await call(`products/${productId}`, { method: 'DELETE', cookie: adminCookie, body: {} })).response.ok, '商品を削除');
ok((await call('auth/account', { method: 'DELETE', cookie: userCookie, body: { password: 'test-pass-1234', confirmation: '削除' } })).response.ok, '動作確認会員を削除');
ok((await call('auth/me', { cookie: userCookie })).data.user === null, '削除後の会員セッションを無効化');
ok((await call('admin/logout', { method: 'POST', cookie: adminCookie, body: {} })).response.ok, '管理者ログアウト');

console.log('All smoke tests passed.');
