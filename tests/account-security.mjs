import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:8794';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) throw new Error('Security tests only run against localhost.');
const runId = Date.now();
const email = `security-${runId}@example.com`;
const oldPassword = 'test-only-old-password-123';
const newPassword = 'test-only-new-password-456';
let currentPassword = oldPassword;
let currentCookie = '';
const ip = `192.0.2.${runId % 200 + 1}`;
async function call(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(`${base}/api/${path}`, {
    method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { response, data: await response.json().catch(() => ({})), cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}
const post = (path, body, cookie) => call(path, { method: 'POST', body, cookie });
const check = (condition, message) => { assert.ok(condition, message); console.log(`✓ ${message}`); };
try {
  const short = await post('auth/register', { name: 'テスト', email, password: 'short-123', privacyConsent: true });
  check(short.response.status === 400, '短い新規パスワードを拒否');
  const registered = await post('auth/register', { name: '安全設定テスト', email, password: oldPassword, privacyConsent: true });
  check(registered.response.status === 201, '新規会員を作成');
  currentCookie = registered.cookie;
  const second = await post('auth/login', { email, password: oldPassword });
  check(second.response.ok && second.cookie !== currentCookie, '別端末のログインを作成');
  check((await post('auth/password', { currentPassword: 'wrong-password', newPassword }, currentCookie)).response.status === 401, '現在のパスワード確認を必須にする');
  check((await call('auth/me', { cookie: second.cookie })).data.user?.email === email, '変更失敗で他端末をログアウトさせない');
  check((await call('auth/password', { method: 'POST', cookie: currentCookie, body: { currentPassword: oldPassword, newPassword }, headers: { origin: 'https://attacker.invalid' } })).response.status === 403, '外部サイトからの変更を拒否');
  const changed = await post('auth/password', { currentPassword: oldPassword, newPassword }, currentCookie);
  check(changed.response.ok && /Max-Age=0/.test(changed.response.headers.get('set-cookie')), 'パスワード変更とCookie解除');
  currentPassword = newPassword;
  for (const cookie of [currentCookie, second.cookie]) check((await call('auth/me', { cookie })).data.user === null, '変更前の端末セッションを無効化');
  check((await post('auth/login', { email, password: oldPassword })).response.status === 401, '古いパスワードを拒否');
  const login = await post('auth/login', { email, password: newPassword });
  check(login.response.ok, '変更後のパスワードでログイン'); currentCookie = login.cookie;
  const other = await post('auth/login', { email, password: newPassword });
  check((await call('auth/preferences', { method: 'PUT', cookie: currentCookie, body: { email: true } })).data.error?.code === 'EMAIL_UNAVAILABLE', '未接続のメール通知を有効化させない');
  check((await post('auth/logout-all', {}, currentCookie)).response.ok, '全端末ログアウト');
  check((await call('auth/me', { cookie: other.cookie })).data.user === null, '他端末もログアウト済み');
  currentCookie = (await post('auth/login', { email, password: newPassword })).cookie;
  const badJson = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: '{bad json' });
  check(badJson.status === 400, '壊れたJSONをサーバー障害扱いにしない');
  const large = await post('auth/login', { email, password: 'x'.repeat(70000) });
  check(large.response.status === 413, '大きすぎる送信内容を拒否');
  const adminRead = await call('admin/users');
  check(adminRead.response.status === 401, '未ログインでは会員一覧を取得できない');
  const results = await Promise.all(Array.from({ length: 16 }, () => post('auth/login', { email: `absent-${runId}@example.com`, password: oldPassword })));
  check(results.filter((r) => r.response.status === 401).length === 12 && results.filter((r) => r.response.status === 429).length === 4, '同時ログイン試行にもアカウント単位の上限を適用');
  check(results.some((r) => Number(r.response.headers.get('retry-after')) > 0), '再試行可能時間を返す');
  const adminResults = await Promise.all(Array.from({ length: 12 }, () => post('admin/login', { password: 'not-admin-password' })));
  check(adminResults.filter((r) => r.response.status === 401).length === 10 && adminResults.filter((r) => r.response.status === 429).length === 2, '管理者ログインの連続試行も制限');
} finally {
  if (currentCookie) {
    const removed = await call('auth/account', { method: 'DELETE', cookie: currentCookie, body: { password: currentPassword, confirmation: '削除' } });
    check(removed.response.ok, 'テスト会員を削除');
  }
}
console.log('Account security tests passed.');
