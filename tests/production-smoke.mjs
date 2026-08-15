const base = process.env.LUX_BASE_URL;
const password = process.env.LUX_ADMIN_PASSWORD;
if (!base || !password) throw new Error('LUX_BASE_URL and LUX_ADMIN_PASSWORD are required.');

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const home = await fetch(base, { redirect: 'follow' });
ok(home.ok && (await home.text()).includes('Lux Canis'), '公開トップページ');
const productsResponse = await fetch(`${base}/api/products`);
const products = await productsResponse.json();
ok(productsResponse.ok && products.products.length >= 6, '公開商品API');
const denied = await fetch(`${base}/api/admin/overview`);
ok(denied.status === 401, '未ログインの管理画面APIを拒否');
const login = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
ok(login.ok && cookie.startsWith('lux_admin_session='), '本番管理者ログイン');
const overview = await fetch(`${base}/api/admin/overview`, { headers: { cookie } });
ok(overview.ok && (await overview.json()).metrics.products >= 6, '本番運営データ取得');
await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
console.log('Production smoke tests passed.');
