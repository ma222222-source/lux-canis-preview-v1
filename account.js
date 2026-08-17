const state = { user: null, notices: [], restock: [] };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const views = $$('.account-view');
const nav = $$('.account-nav button');
const toast = $('#toast');
let authMode = 'register';
let toastTimer;

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || '処理に失敗しました。'), { status: response.status });
  return payload;
}
function notify(message) { clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show'); toastTimer = setTimeout(() => toast.classList.remove('show'), 3200); }

function showView(name, sync = true) {
  const allowed = ['profile','notifications','restock','notices'];
  const next = allowed.includes(name) ? name : 'profile';
  views.forEach((view) => view.classList.toggle('is-active', view.id === `view-${next}`));
  nav.forEach((button) => { const active = button.dataset.view === next; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
  if (next === 'restock') renderRestock();
  if (next === 'notices') renderNotices();
  if (sync) history.replaceState(null, '', `${location.pathname}${location.search}${next === 'profile' ? '' : `#${next}`}`);
}
nav.forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
window.addEventListener('hashchange', () => showView(location.hash.slice(1), false));

$$('[data-auth]').forEach((button) => button.addEventListener('click', () => {
  authMode = button.dataset.auth;
  $$('[data-auth]').forEach((item) => item.classList.toggle('is-active', item === button));
  $('#name-field').hidden = authMode === 'login';
  $('#account-name').required = authMode === 'register';
  $('#password-confirm-field').hidden = authMode === 'login';
  $('#account-password-confirm').required = authMode === 'register';
  $('#account-password').autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
  $('#account-password-confirm').autocomplete = authMode === 'register' ? 'new-password' : 'off';
  $('#account-submit').textContent = authMode === 'register' ? '無料で登録する' : 'ログインする';
  $('#account-data-note').hidden = authMode === 'login';
  $('#password-confirm-error').textContent = '';
  $('#account-password-confirm').setCustomValidity('');
  $('#auth-error').textContent = '';
}));

$('#toggle-password').addEventListener('click', () => {
  const input = $('#account-password');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('#account-password-confirm').type = input.type;
  $('#toggle-password').textContent = input.type === 'password' ? '表示' : '隠す';
  $('#toggle-password').setAttribute('aria-label', input.type === 'password' ? 'パスワードを表示' : 'パスワードを隠す');
});

$('#account-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  $('#auth-error').textContent = '';
  $('#password-confirm-error').textContent = '';
  $('#account-password-confirm').setCustomValidity('');
  if (authMode === 'register' && $('#account-password').value !== $('#account-password-confirm').value) {
    $('#account-password-confirm').setCustomValidity('パスワードが一致しません。');
    $('#password-confirm-error').textContent = 'パスワードが一致しません。';
  }
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const button = $('#account-submit'); button.disabled = true; button.textContent = '処理中…';
  try {
    const payload = { name: $('#account-name').value, email: $('#account-email').value, password: $('#account-password').value };
    const result = await api(`auth/${authMode}`, { method: 'POST', body: JSON.stringify(payload) });
    state.user = result.user;
    form.reset(); renderAccount(); await loadRestock();
    notify(authMode === 'register' ? '会員登録が完了しました。' : 'ログインしました。');
  } catch (error) { $('#auth-error').textContent = error.message; } finally { button.disabled = false; button.textContent = authMode === 'register' ? '無料で登録する' : 'ログインする'; }
});

$('#logout-button').addEventListener('click', async () => {
  await api('auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
  state.user = null; state.restock = []; renderAccount(); showView('profile'); notify('ログアウトしました。');
});

function renderAccount() {
  $('#signed-out').hidden = Boolean(state.user);
  $('#signed-in').hidden = !state.user;
  $('#preference-list').hidden = !state.user;
  $$('.login-required').forEach((item) => item.hidden = Boolean(state.user));
  if (state.user) {
    $('#profile-name').textContent = `${state.user.name} さん`;
    $('#profile-email').textContent = state.user.email;
    $$('[data-pref]').forEach((input) => input.checked = Boolean(state.user.preferences?.[input.dataset.pref]));
  }
  renderRestock();
}

$$('[data-pref]').forEach((input) => input.addEventListener('change', async () => {
  if (!state.user) return;
  const preferences = Object.fromEntries($$('[data-pref]').map((item) => [item.dataset.pref, item.checked]));
  try {
    const result = await api('auth/preferences', { method: 'PUT', body: JSON.stringify(preferences) });
    state.user.preferences = result.preferences;
    notify('通知設定を保存しました。');
  } catch (error) { input.checked = !input.checked; notify(error.message); }
}));

async function loadRestock() {
  if (!state.user) { state.restock = []; renderRestock(); return; }
  try { state.restock = (await api('restock')).requests; } catch (error) { notify(error.message); }
  renderRestock();
}

function renderRestock() {
  const root = $('#restock-list');
  if (!state.user) { root.innerHTML = '<div class="account-empty"><strong>ログインすると再販待ちを確認できます</strong><a class="button button-dark" href="#">ログイン・会員登録へ</a></div>'; root.querySelector('a').onclick = (event) => { event.preventDefault(); showView('profile'); }; return; }
  root.innerHTML = state.restock.length ? state.restock.map((item) => `<article class="restock-item"><img src="${esc(item.images?.[0] || '/icon.svg')}" alt=""><div><strong>${esc(item.product_name)}</strong><p>${esc(item.color || 'カラー指定なし')} / ${new Date(item.created_at).toLocaleDateString('ja-JP')} 登録</p></div><button type="button" data-remove-restock="${esc(item.id)}">解除</button></article>`).join('') : '<div class="account-empty"><strong>再販待ちの商品はありません</strong><a class="button button-dark" href="./index.html#items">商品を見る</a></div>';
  $$('[data-remove-restock]').forEach((button) => button.addEventListener('click', async () => {
    try { await api(`restock/${button.dataset.removeRestock}`, { method: 'DELETE', body: '{}' }); await loadRestock(); notify('再販待ちを解除しました。'); } catch (error) { notify(error.message); }
  }));
}

function renderNotices() {
  const label = { news: 'NEW', restock: '再販', color: '新色', important: '重要' };
  $('#notice-list').innerHTML = state.notices.length ? state.notices.map((notice) => `<article><span>${label[notice.type] || 'NEWS'}</span><div><strong>${esc(notice.title)}</strong><p>${esc(notice.body)}</p><footer><time>${new Date(notice.created_at).toLocaleDateString('ja-JP')}</time>${notice.product_id ? `<a href="./product.html?id=${encodeURIComponent(notice.product_id)}">関連商品を見る →</a>` : ''}</footer></div></article>`).join('') : '<div class="account-empty"><strong>お知らせはまだありません</strong></div>';
}

async function init() {
  try {
    const [me, notices] = await Promise.all([api('auth/me'), api('notices')]);
    state.user = me.user;
    state.notices = notices.notices;
    renderAccount(); renderNotices(); await loadRestock();
  } catch (error) { notify(error.message); renderAccount(); }
  showView(location.hash.slice(1), false);
}
init();
