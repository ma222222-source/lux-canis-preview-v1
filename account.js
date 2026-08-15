const views = [...document.querySelectorAll('.account-view')];
const nav = [...document.querySelectorAll('.account-nav button')];
const allowedViews = ['profile', 'notifications', 'restock', 'notices'];
const toast = document.querySelector('#toast');
const accountKey = 'luxAccount';
let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function showView(name, { syncHash = true } = {}) {
  const nextView = allowedViews.includes(name) ? name : 'profile';
  views.forEach((view) => view.classList.toggle('is-active', view.id === `view-${nextView}`));
  nav.forEach((button) => {
    const active = button.dataset.view === nextView;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (nextView === 'restock') renderRestock();
  if (syncHash) {
    const hash = nextView === 'profile' ? '' : `#${nextView}`;
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
  }
}

nav.forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
window.addEventListener('hashchange', () => showView(location.hash.slice(1), { syncHash: false }));

let authMode = 'register';
document.querySelectorAll('[data-auth]').forEach((button) => button.addEventListener('click', () => {
  authMode = button.dataset.auth;
  document.querySelectorAll('[data-auth]').forEach((item) => item.classList.toggle('is-active', item === button));
  document.querySelector('#account-submit').textContent = authMode === 'register' ? '無料で登録する' : 'ログインする';
  document.querySelector('#account-name').closest('label').hidden = authMode === 'login';
}));

const passwordInput = document.querySelector('#account-password');
const passwordToggle = document.querySelector('#toggle-password');
passwordToggle.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  passwordToggle.textContent = showing ? '表示' : '非表示';
  passwordToggle.setAttribute('aria-label', showing ? 'パスワードを表示' : 'パスワードを非表示');
});

const form = document.querySelector('#account-form');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  let valid = true;
  let firstInvalid;
  form.querySelectorAll('[required]').forEach((input) => {
    const label = input.closest('label');
    if (label.hidden) return;
    const error = label.querySelector('.field-error');
    error.textContent = '';
    if (!input.value.trim() || !input.checkValidity()) {
      error.textContent = input.type === 'email'
        ? '正しいメールアドレスを入力してください。'
        : input.type === 'password'
          ? '8文字以上で入力してください。'
          : '入力してください。';
      firstInvalid ||= input;
      valid = false;
    }
  });
  if (!valid) {
    firstInvalid?.focus();
    return;
  }
  const existing = JSON.parse(localStorage.getItem(accountKey) || 'null');
  const data = {
    name: document.querySelector('#account-name').value || existing?.name || 'ゲスト',
    email: document.querySelector('#account-email').value,
  };
  localStorage.setItem(accountKey, JSON.stringify(data));
  updateAuth();
  showToast(authMode === 'register' ? '入力内容をこの端末に保存しました。' : 'ログインしました。');
});

function updateAuth() {
  const account = JSON.parse(localStorage.getItem(accountKey) || 'null');
  document.querySelector('#signed-out').hidden = Boolean(account);
  document.querySelector('#signed-in').hidden = !account;
  if (account) {
    document.querySelector('#profile-name').textContent = account.name;
    document.querySelector('#profile-email').textContent = account.email;
  }
}

document.querySelector('#logout-button').addEventListener('click', () => {
  localStorage.removeItem(accountKey);
  updateAuth();
  showToast('ログアウトしました。');
});

const preferences = JSON.parse(localStorage.getItem('luxPrefs') || '{}');
document.querySelectorAll('[data-pref]').forEach((input) => {
  if (input.dataset.pref in preferences) input.checked = preferences[input.dataset.pref];
  input.addEventListener('change', () => {
    const next = {};
    document.querySelectorAll('[data-pref]').forEach((item) => { next[item.dataset.pref] = item.checked; });
    localStorage.setItem('luxPrefs', JSON.stringify(next));
    showToast('通知設定を保存しました。');
  });
});

const pushState = document.querySelector('#push-state');
const pushButton = document.querySelector('#enable-push');

function updatePush() {
  if (!('Notification' in window)) {
    pushState.textContent = 'このブラウザは通知機能に対応していません。';
    pushButton.disabled = true;
    return;
  }
  pushState.textContent = Notification.permission === 'granted'
    ? 'この端末では通知が許可されています。'
    : Notification.permission === 'denied'
      ? '端末またはブラウザ設定で通知が拒否されています。'
      : 'まだ通知を許可していません。';
  pushButton.disabled = Notification.permission === 'denied';
  pushButton.textContent = Notification.permission === 'granted'
    ? 'テスト通知を表示'
    : Notification.permission === 'denied'
      ? '端末設定で変更してください'
      : '通知を許可する';
}

pushButton.addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  updatePush();
  if (permission === 'granted') {
    const registration = await navigator.serviceWorker?.ready;
    registration?.showNotification('Lux Canis', {
      body: '通知設定が完了しました。新作や再販情報をここで受け取れます。',
      icon: './icon.svg',
    });
    showToast('テスト通知を表示しました。');
  }
});

function renderRestock() {
  const list = document.querySelector('#restock-list');
  const items = JSON.parse(localStorage.getItem('luxRestock') || '[]');
  if (!items.length) {
    list.innerHTML = '<div class="empty-card"><strong>再販待ちの商品はありません</strong><p>売り切れ商品の詳細ページから登録できます。</p><a class="button button-primary" href="./index.html#items">商品を見る</a></div>';
    return;
  }
  const imageMap = { 'tiny-drop': 'item-04.webp' };
  list.innerHTML = items.map((item) => `<article class="restock-item"><img src="./assets/${imageMap[item.id] || 'item-04.webp'}" alt=""><div><strong>${item.name}</strong><p>${item.color} / 再販待ち登録中</p></div><button type="button" data-remove="${item.id}">登録を解除</button></article>`).join('');
  list.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
    localStorage.setItem('luxRestock', JSON.stringify(items.filter((item) => item.id !== button.dataset.remove)));
    renderRestock();
    showToast('再販通知を解除しました。');
  }));
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
updateAuth();
updatePush();
renderRestock();
showView(location.hash.slice(1), { syncHash: false });
