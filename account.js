const state = { user: null, notices: [], restock: [] };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const views = $$('.account-view');
const nav = $$('.account-nav button');
const toast = $('#toast');
const PRIVACY_VERSION = '2026-08-17';
let authMode = 'register';
let toastTimer;
let authBusy = false;

function returnToProduct() {
  const next = new URLSearchParams(location.search).get('next');
  if (!next) return false;
  try {
    const url = new URL(next, location.origin);
    if (url.origin !== location.origin || !['/product', '/product.html'].includes(url.pathname) || !url.searchParams.get('id')) return false;
    location.assign(url.pathname + url.search);
    return true;
  } catch { return false; }
}

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
  if (authBusy) return;
  authMode = button.dataset.auth;
  $$('[data-auth]').forEach((item) => {
    const active = item === button;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  $('#name-field').hidden = authMode === 'login';
  $('#account-name').required = authMode === 'register';
  $('#password-confirm-field').hidden = authMode === 'login';
  $('#account-password-confirm').required = authMode === 'register';
  $('#privacy-consent-field').hidden = authMode === 'login';
  $('#privacy-consent').required = authMode === 'register';
  $('#account-password').autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
  $('#account-password-confirm').autocomplete = authMode === 'register' ? 'new-password' : 'off';
  $('#account-submit').textContent = authMode === 'register' ? '無料で登録する' : 'ログインする';
  $('#account-data-note').hidden = authMode === 'login';
  $('#password-confirm-error').textContent = '';
  $('#account-password-confirm').setCustomValidity('');
  $('#privacy-consent-error').textContent = '';
  $('#privacy-consent').setCustomValidity('');
  $('#auth-error').textContent = '';
}));

$('#toggle-password').addEventListener('click', () => {
  const input = $('#account-password');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('#account-password-confirm').type = input.type;
  $('#toggle-password').textContent = input.type === 'password' ? '表示' : '隠す';
  $('#toggle-password').setAttribute('aria-label', input.type === 'password' ? 'パスワードを表示' : 'パスワードを隠す');
});

$('#privacy-consent').addEventListener('change', (event) => {
  event.currentTarget.setCustomValidity('');
  $('#privacy-consent-error').textContent = '';
});

$('#account-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (authBusy) return;
  const form = event.currentTarget;
  $('#auth-error').textContent = '';
  $('#password-confirm-error').textContent = '';
  $('#account-password-confirm').setCustomValidity('');
  $('#privacy-consent-error').textContent = '';
  $('#privacy-consent').setCustomValidity('');
  if (authMode === 'register' && $('#account-password').value !== $('#account-password-confirm').value) {
    $('#account-password-confirm').setCustomValidity('パスワードが一致しません。');
    $('#password-confirm-error').textContent = 'パスワードが一致しません。';
  }
  if (authMode === 'register' && !$('#privacy-consent').checked) {
    $('#privacy-consent').setCustomValidity('プライバシーポリシーへの同意が必要です。');
    $('#privacy-consent-error').textContent = '会員登録にはプライバシーポリシーへの同意が必要です。';
  }
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const button = $('#account-submit'); button.disabled = true; button.textContent = '処理中…';
  authBusy = true;
  const submittedMode = authMode;
  form.setAttribute('aria-busy', 'true');
  $$('[data-auth]').forEach((item) => { item.disabled = true; });
  try {
    const payload = { name: $('#account-name').value, email: $('#account-email').value, password: $('#account-password').value };
    if (authMode === 'register') Object.assign(payload, { privacyConsent: $('#privacy-consent').checked, privacyVersion: PRIVACY_VERSION });
    const result = await api(`auth/${authMode}`, { method: 'POST', body: JSON.stringify(payload) });
    state.user = result.user;
    form.reset();
    $('#account-password').type = $('#account-password-confirm').type = 'password';
    $('#toggle-password').textContent = '表示';
    $('#toggle-password').setAttribute('aria-label', 'パスワードを表示');
    renderAccount();
    if (returnToProduct()) return;
    await loadRestock();
    notify(submittedMode === 'register' ? '会員登録が完了しました。' : 'ログインしました。');
  } catch (error) { $('#auth-error').textContent = error.message; } finally {
    authBusy = false;
    form.setAttribute('aria-busy', 'false');
    $$('[data-auth]').forEach((item) => { item.disabled = false; });
    button.disabled = false;
    button.textContent = authMode === 'register' ? '無料で登録する' : 'ログインする';
  }
});

$('#logout-button').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = 'ログアウト中…';
  try {
    await api('auth/logout', { method: 'POST', body: '{}' });
    state.user = null; state.restock = []; renderAccount(); showView('profile'); notify('ログアウトしました。');
  } catch { notify('ログアウトできませんでした。通信を確認して、もう一度お試しください。'); }
  finally { button.disabled = false; button.textContent = 'ログアウト'; }
});

const deleteDialog = $('#delete-account-dialog');
const deleteForm = $('#delete-account-form');
function closeDeleteDialog() { if (deleteDialog.open) deleteDialog.close(); }
$('#open-delete-account').addEventListener('click', () => {
  deleteForm.reset();
  $('#delete-account-error').textContent = '';
  $('#delete-confirmation-error').textContent = '';
  $('#delete-account-confirmation').setCustomValidity('');
  deleteDialog.showModal();
  document.body.classList.add('dialog-open');
  $('#delete-account-password').focus();
});
$('#close-delete-account').addEventListener('click', closeDeleteDialog);
$('#cancel-delete-account').addEventListener('click', closeDeleteDialog);
deleteDialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  deleteForm.reset();
  $('#delete-account-password').type = 'password';
  $('#toggle-delete-password').textContent = '表示';
  $('#toggle-delete-password').setAttribute('aria-label', 'パスワードを表示');
});
deleteDialog.addEventListener('click', (event) => { if (event.target === deleteDialog) closeDeleteDialog(); });
$('#toggle-delete-password').addEventListener('click', () => {
  const input = $('#delete-account-password');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('#toggle-delete-password').textContent = input.type === 'password' ? '表示' : '隠す';
  $('#toggle-delete-password').setAttribute('aria-label', input.type === 'password' ? 'パスワードを表示' : 'パスワードを隠す');
});
$('#delete-account-confirmation').addEventListener('input', (event) => { event.currentTarget.setCustomValidity(''); $('#delete-confirmation-error').textContent = ''; });
deleteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const confirmation = $('#delete-account-confirmation');
  confirmation.setCustomValidity('');
  $('#delete-confirmation-error').textContent = '';
  $('#delete-account-error').textContent = '';
  if (confirmation.value !== '削除') {
    confirmation.setCustomValidity('「削除」と入力してください。');
    $('#delete-confirmation-error').textContent = '確認欄に「削除」と入力してください。';
  }
  if (!deleteForm.checkValidity()) { deleteForm.reportValidity(); return; }
  const button = $('#confirm-delete-account');
  button.disabled = true;
  button.textContent = '削除中…';
  try {
    await api('auth/account', { method: 'DELETE', body: JSON.stringify({ password: $('#delete-account-password').value, confirmation: confirmation.value }) });
    state.user = null;
    state.restock = [];
    closeDeleteDialog();
    $('#account-form').reset();
    renderAccount();
    showView('profile');
    notify('アカウントを削除しました。');
  } catch (error) {
    $('#delete-account-error').textContent = error.message;
    if (error.status === 401) $('#delete-account-password').focus();
  } finally {
    button.disabled = false;
    button.textContent = '完全に削除する';
  }
});

function renderAccount() {
  $('#signed-out').hidden = Boolean(state.user);
  $('#signed-in').hidden = !state.user;
  $('#preference-list').hidden = !state.user;
  $$('.login-required').forEach((item) => item.hidden = Boolean(state.user));
  if (state.user) {
    $('#profile-name').textContent = `${state.user.name} さん`;
    $('#profile-email').textContent = state.user.email;
    $('#profile-created').textContent = state.user.createdAt ? new Date(state.user.createdAt).toLocaleDateString('ja-JP') : '登録日を取得できません';
    $$('[data-pref]').forEach((input) => input.checked = Boolean(state.user.preferences?.[input.dataset.pref]));
  }
  renderRestock();
}

function setPreferencesBusy(busy) {
  $('#preference-list').setAttribute('aria-busy', String(busy));
  $$('[data-pref]').forEach((item) => { item.disabled = busy; });
}

$$('[data-pref]').forEach((input) => input.addEventListener('change', async () => {
  if (!state.user) return;
  const preferences = Object.fromEntries($$('[data-pref]').map((item) => [item.dataset.pref, item.checked]));
  setPreferencesBusy(true);
  try {
    const result = await api('auth/preferences', { method: 'PUT', body: JSON.stringify(preferences) });
    state.user.preferences = result.preferences;
    notify('通知設定を保存しました。');
  } catch (error) {
    input.checked = !input.checked;
    notify(`${error.message} 設定を元に戻しました。`);
  } finally {
    setPreferencesBusy(false);
  }
}));

async function loadRestock() {
  if (!state.user) { state.restock = []; renderRestock(); return; }
  try { state.restock = (await api('restock')).requests; } catch (error) { notify(error.message); }
  renderRestock();
}

function renderRestock() {
  const root = $('#restock-list');
  if (!state.user) { root.innerHTML = '<div class="account-empty"><strong>ログインすると再販待ちを確認できます</strong><a class="button button-dark" href="#">ログイン・会員登録へ</a></div>'; root.querySelector('a').onclick = (event) => { event.preventDefault(); showView('profile'); }; return; }
  root.innerHTML = state.restock.length ? state.restock.map((item) => `<article class="restock-item"><img src="${esc(item.images?.[0] || '/icon.svg')}" alt="${esc(item.product_name)}の商品写真" loading="lazy"><div><strong>${esc(item.product_name)}</strong><p>${esc(item.color || 'カラー指定なし')} / ${new Date(item.created_at).toLocaleDateString('ja-JP')} 登録</p></div><button type="button" data-remove-restock="${esc(item.id)}">解除</button></article>`).join('') : '<div class="account-empty"><strong>再販待ちの商品はありません</strong><a class="button button-dark" href="./index.html#items">商品を見る</a></div>';
  $$('[data-remove-restock]').forEach((button) => button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true; button.textContent = '解除中…';
    try { await api(`restock/${button.dataset.removeRestock}`, { method: 'DELETE', body: '{}' }); await loadRestock(); notify('再販待ちを解除しました。'); }
    catch (error) { notify(error.message); }
    finally { button.disabled = false; button.textContent = '解除'; }
  }));
}

function renderNotices() {
  if (state.notices === null) {
    $('#notice-list').innerHTML = '<div class="account-empty"><strong>お知らせを読み込めませんでした</strong><button class="button button-dark" type="button" id="retry-account-notices">もう一度読み込む</button></div>';
    $('#retry-account-notices').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = '読み込み中…';
      try { state.notices = (await api('notices')).notices; renderNotices(); }
      catch { notify('通信状態を確認して、もう一度お試しください。'); button.disabled = false; button.textContent = 'もう一度読み込む'; }
    });
    return;
  }
  const label = { news: '新作', restock: '再販', color: '新色', important: '重要' };
  $('#notice-list').innerHTML = state.notices.length ? state.notices.map((notice) => `<article><span>${label[notice.type] || 'お知らせ'}</span><div><strong>${esc(notice.title)}</strong><p>${esc(notice.body)}</p><footer><time>${new Date(notice.created_at).toLocaleDateString('ja-JP')}</time>${notice.product_id ? `<a href="./product.html?id=${encodeURIComponent(notice.product_id)}">関連商品を見る →</a>` : ''}</footer></div></article>`).join('') : '<div class="account-empty"><strong>お知らせはまだありません</strong></div>';
}

async function init() {
  const [me, notices] = await Promise.allSettled([api('auth/me'), api('notices')]);
  if (me.status === 'fulfilled') state.user = me.value.user;
  else notify('ログイン状態を確認できませんでした。ページを再読み込みしてください。');
  renderAccount();
  if (notices.status === 'fulfilled') { state.notices = notices.value.notices; renderNotices(); }
  else {
    state.notices = null;
    renderNotices();
  }
  await loadRestock();
  showView(location.hash.slice(1), false);
}
init();
