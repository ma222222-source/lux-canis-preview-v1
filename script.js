const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const header = $('.site-header');
const menuButton = $('.menu-button');
const menu = $('#site-menu');
const scrim = $('.menu-scrim');
const toast = $('#toast');
const productGrid = $('.product-grid');
const filterButtons = $$('.filter-button');
let products = [];
let activeFilter = 'all';
let toastTimer;

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const yen = (value) => Number(value) > 0 ? `¥${Number(value).toLocaleString('ja-JP')}` : '価格未設定';
const statusLabel = { new: 'NEW', low: '残りわずか', sold: 'SOLD OUT' };

window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
$('#year').textContent = new Date().getFullYear();
$('.footer')?.insertAdjacentHTML('beforeend', '<a class="admin-demo-link" href="./admin.html" rel="nofollow">運営管理</a>');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

function showToast(message) { clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show'); toastTimer = setTimeout(() => toast.classList.remove('show'), 3200); }
function openMenu() { menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false'); menuButton.setAttribute('aria-expanded', 'true'); scrim.hidden = false; document.body.classList.add('menu-open'); $('.menu-close').focus(); }
function closeMenu() { menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true'); menuButton.setAttribute('aria-expanded', 'false'); scrim.hidden = true; document.body.classList.remove('menu-open'); }
menuButton?.addEventListener('click', openMenu);
$$('[data-menu-close]').forEach((element) => element.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });

function renderProducts() {
  const visible = products.filter((product) => activeFilter === 'all' || product.category === activeFilter);
  if (!visible.length) {
    productGrid.innerHTML = '<div class="catalog-empty"><p class="kicker">COMING SOON</p><h3>このカテゴリの商品は準備中です</h3><p>新しい商品が公開されると、こちらに表示されます。</p></div>';
    return;
  }
  productGrid.innerHTML = visible.map((product) => {
    const image = product.images?.[0] || '/icon.svg';
    const badge = statusLabel[product.status] ? `<span class="product-badge product-badge-${esc(product.status)}">${statusLabel[product.status]}</span>` : '';
    const color = product.colors?.slice(0, 3).join(' / ') || 'Color variation';
    return `<article class="product-card"><a class="product-open" href="./product.html?id=${encodeURIComponent(product.id)}" aria-label="${esc(product.name)}の商品詳細を見る"><span class="product-image">${badge}<img src="${esc(image)}" alt="${esc(product.name)}の商品写真" loading="lazy"></span><span class="product-meta"><span><strong>${esc(product.name)}</strong><small>${esc(color)}</small></span><span class="price">${yen(product.price)}</span></span><span class="product-facts"><span>カラー ${esc(color)}</span><span>素材 ${esc(product.material || '未設定')}</span></span><span class="detail-link">商品詳細を見る <span>→</span></span></a></article>`;
  }).join('');
}

function applyFilter(filter) {
  activeFilter = filter;
  filterButtons.forEach((button) => { const active = button.dataset.filter === filter; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
  renderProducts();
}
filterButtons.forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
$$('[data-filter-link]').forEach((link) => link.addEventListener('click', () => applyFilter(link.dataset.filterLink)));

$$('.demo-action, .pseudo-mercari').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.message || '販売URLは現在未設定です。')));

async function loadProducts() {
  productGrid.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/products', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('商品を取得できませんでした。');
    products = (await response.json()).products;
    renderProducts();
  } catch (error) {
    console.error(error);
    showToast('商品情報を読み込めませんでした。時間をおいてお試しください。');
  } finally { productGrid.setAttribute('aria-busy', 'false'); }
}
loadProducts();
