const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const header = $('.home-header');
const menuButton = $('.menu-button');
const menu = $('#site-menu');
const scrim = $('.menu-scrim');
const toast = $('#toast');
const productRail = $('#product-rail');
const featureRail = $('#feature-rail');
const favoritesRail = $('#favorites-rail');
const filterButtons = $$('.filter-button');
const menuBackground = [header, $('main'), $('.home-footer')].filter(Boolean);
const favoritesKey = 'lux-canis-favorites';

let products = [];
let activeFilter = 'all';
let favorites = readFavorites();
let toastTimer;

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const yen = (value) => Number(value) > 0 ? `¥${Number(value).toLocaleString('ja-JP')}` : '価格未設定';
const featureLabels = { new: '新作', low: '注目', sold: '再販待ち', available: 'おすすめ' };

function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
    return Array.isArray(saved) ? saved.map(String) : [];
  } catch { return []; }
}

function saveFavorites() {
  try { localStorage.setItem(favoritesKey, JSON.stringify(favorites)); } catch { /* 保存できない環境では表示中のみ保持 */ }
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function openMenu() {
  menu.classList.add('is-open');
  menu.setAttribute('aria-hidden', 'false');
  menuButton.setAttribute('aria-expanded', 'true');
  scrim.hidden = false;
  document.body.classList.add('menu-open');
  setTimeout(() => {
    menuBackground.forEach((element) => { element.inert = true; });
    $('.menu-close', menu)?.focus();
  }, 0);
}

function closeMenu({ restoreFocus = true } = {}) {
  if (!menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  menuButton.setAttribute('aria-expanded', 'false');
  scrim.hidden = true;
  document.body.classList.remove('menu-open');
  menuBackground.forEach((element) => { element.inert = false; });
  if (restoreFocus) setTimeout(() => menuButton.focus(), 0);
}

menuButton?.addEventListener('click', openMenu);
$$('[data-menu-close]').forEach((element) => element.addEventListener('click', () => closeMenu({ restoreFocus: element.tagName !== 'A' })));
document.addEventListener('keydown', (event) => {
  if (!menu?.classList.contains('is-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
  if (event.key !== 'Tab') return;
  const focusable = $$('a[href], button:not([disabled])', menu).filter((element) => !element.hidden && element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!menu.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

function productCard(product, { feature = false } = {}) {
  const id = String(product.id);
  const image = product.images?.[0] || './assets/lux-canis-logo.jpg';
  const liked = favorites.includes(id);
  const label = feature ? `<span class="feature-label">${featureLabels[product.status] || 'おすすめ'}</span>` : '';
  return `<article class="product-card${feature ? ' feature-card' : ''}">
    <a href="./product.html?id=${encodeURIComponent(id)}" aria-label="${esc(product.name)}の商品詳細を見る">
      <span class="product-card-image">${label}<img src="${esc(image)}" alt="${esc(product.name)}の商品写真" loading="lazy"></span>
      <span class="product-card-copy"><strong>${esc(product.name)}</strong><span>${yen(product.price)}</span></span>
    </a>
    <button class="favorite-button" type="button" data-favorite-id="${esc(id)}" aria-label="${esc(product.name)}をいいね${liked ? 'から外す' : 'に追加'}" aria-pressed="${liked}"><span aria-hidden="true">♡</span></button>
  </article>`;
}

function renderProducts() {
  const visible = products.filter((product) => activeFilter === 'all' || product.category === activeFilter);
  if (!visible.length) {
    productRail.innerHTML = '<div class="catalog-empty"><h3>このカテゴリーは準備中です</h3><p>商品が公開されると、こちらに表示されます。</p></div>';
  } else {
    productRail.innerHTML = visible.map((product) => productCard(product)).join('');
  }

  const ordered = [...products].sort((a, b) => {
    const priority = { new: 0, low: 1, sold: 2, available: 3 };
    return (priority[a.status] ?? 4) - (priority[b.status] ?? 4);
  }).slice(0, 6);
  featureRail.innerHTML = ordered.length ? ordered.map((product) => productCard(product, { feature: true })).join('') : '<div class="catalog-empty"><h3>新作を準備中です</h3><p>公開まで少しお待ちください。</p></div>';
  renderFavorites();
}

function renderFavorites() {
  const likedProducts = products.filter((product) => favorites.includes(String(product.id)));
  favoritesRail.innerHTML = likedProducts.length ? likedProducts.map((product) => productCard(product)).join('') : '<div class="favorites-empty"><h3>いいねした商品はまだありません</h3><p>商品の♡を押すと、ここでまとめて見返せます。</p></div>';
}

function toggleFavorite(id) {
  const product = products.find((item) => String(item.id) === String(id));
  if (!product) return;
  if (favorites.includes(String(id))) {
    favorites = favorites.filter((favoriteId) => favoriteId !== String(id));
    showToast('いいねから外しました。');
  } else {
    favorites = [...favorites, String(id)];
    showToast('いいねに追加しました。');
  }
  saveFavorites();
  renderProducts();
}

document.addEventListener('click', (event) => {
  const favoriteButton = event.target.closest('[data-favorite-id]');
  if (favoriteButton) toggleFavorite(favoriteButton.dataset.favoriteId);
});

function applyFilter(filter) {
  activeFilter = filter;
  filterButtons.forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderProducts();
  productRail.scrollTo({ left: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

filterButtons.forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
$$('[data-filter-link]').forEach((link) => link.addEventListener('click', () => applyFilter(link.dataset.filterLink)));

$$('[data-scroll]').forEach((button) => button.addEventListener('click', () => {
  const rail = document.getElementById(button.dataset.scroll);
  if (!rail) return;
  const amount = Math.max(280, rail.clientWidth * .78) * (button.dataset.direction === 'prev' ? -1 : 1);
  rail.scrollBy({ left: amount, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}));

$$('.demo-action').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.message || 'このリンクは準備中です。')));

async function loadProducts() {
  productRail.setAttribute('aria-busy', 'true');
  featureRail.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/products', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('商品を取得できませんでした。');
    products = (await response.json()).products || [];
    renderProducts();
  } catch (error) {
    console.error(error);
    const retry = '<div class="catalog-empty"><h3>商品を読み込めませんでした</h3><p>通信状態をご確認のうえ、もう一度お試しください。</p><button class="button button-dark retry-products" type="button">再読み込みする</button></div>';
    productRail.innerHTML = retry;
    featureRail.innerHTML = retry;
    $$('.retry-products').forEach((button) => button.addEventListener('click', loadProducts));
    renderFavorites();
  } finally {
    productRail.setAttribute('aria-busy', 'false');
    featureRail.setAttribute('aria-busy', 'false');
  }
}

async function loadNotices() {
  const root = $('#home-notice-list');
  if (!root) return;
  try {
    const response = await fetch('/api/notices', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('お知らせを取得できませんでした。');
    const notices = ((await response.json()).notices || []).slice(0, 3);
    const labels = { news: '新作', restock: '再販', color: '新色', important: '重要' };
    root.innerHTML = notices.length ? notices.map((notice) => `<article class="home-notice-card"><div class="home-notice-meta"><span>${labels[notice.type] || 'お知らせ'}</span><time datetime="${esc(notice.created_at)}">${new Date(notice.created_at).toLocaleDateString('ja-JP')}</time></div><div><h3>${esc(notice.title)}</h3><p>${esc(notice.body)}</p>${notice.product_id ? `<a href="./product.html?id=${encodeURIComponent(notice.product_id)}">関連商品を見る →</a>` : ''}</div></article>`).join('') : '<div class="home-notice-empty">現在、新しいお知らせはありません。</div>';
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="home-notice-empty">お知らせを読み込めませんでした。<button class="button button-dark" id="retry-notices" type="button">再読み込みする</button></div>';
    $('#retry-notices')?.addEventListener('click', loadNotices);
  } finally { root.setAttribute('aria-busy', 'false'); }
}

let headerScrollFrame = 0;
let headerScrolled = null;
function updateHeaderState() {
  headerScrollFrame = 0;
  const next = window.scrollY > 32;
  if (next === headerScrolled) return;
  headerScrolled = next;
  header?.classList.toggle('scrolled', next);
}
function scheduleHeaderUpdate() {
  if (!headerScrollFrame) headerScrollFrame = requestAnimationFrame(updateHeaderState);
}
updateHeaderState();
window.addEventListener('scroll', scheduleHeaderUpdate, { passive: true });
$('#year').textContent = new Date().getFullYear();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
loadProducts();
loadNotices();
