const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-button');
const menu = document.querySelector('#site-menu');
const scrim = document.querySelector('.menu-scrim');
const toast = document.querySelector('#toast');
const productCards = [...document.querySelectorAll('.product-card')];
const filterButtons = [...document.querySelectorAll('.filter-button')];
let toastTimer;

const products = [
  { id: 'color-mix', category: 'ear', status: 'new', material: 'ガラスビーズ / 金具' },
  { id: 'forest-drop', category: 'ear', status: 'low', material: 'ガラスビーズ / 金具' },
  { id: 'soft-aurora', category: 'ear', status: 'new', material: 'ガラスビーズ / 金具' },
  { id: 'tiny-drop', category: 'ear', status: 'sold', material: 'ガラスビーズ / 雫パーツ' },
  { id: 'mini-hoop', category: 'ear', status: '', material: 'ガラスビーズ / 金具' },
  { id: 'long-beads', category: 'ear', status: 'low', material: 'ガラスビーズ / 金具' }
];

const emptyState = document.createElement('div');
emptyState.className = 'catalog-empty';
emptyState.hidden = true;
emptyState.innerHTML = '<p class="kicker">COMING SOON</p><h3>ブレスレットは準備中です</h3><p>新しい商品写真が揃い次第、こちらに追加します。</p>';
document.querySelector('.product-grid').insertAdjacentElement('afterend', emptyState);

window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
document.querySelector('#year').textContent = new Date().getFullYear();
document.querySelector('.footer')?.insertAdjacentHTML('beforeend', '<a class="admin-demo-link" href="./admin.html" rel="nofollow">管理画面（確認用）</a>');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

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
  document.querySelector('.menu-close').focus();
}

function closeMenu() {
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  menuButton.setAttribute('aria-expanded', 'false');
  scrim.hidden = true;
  document.body.classList.remove('menu-open');
}

menuButton?.addEventListener('click', openMenu);
document.querySelectorAll('[data-menu-close]').forEach((element) => element.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });

function applyFilter(filter) {
  filterButtons.forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  productCards.forEach((card, index) => {
    card.hidden = filter !== 'all' && products[index].category !== filter;
  });
  emptyState.hidden = productCards.some(card => !card.hidden);
}

filterButtons.forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
document.querySelectorAll('[data-filter-link]').forEach((link) => link.addEventListener('click', () => applyFilter(link.dataset.filterLink)));

productCards.forEach((card, index) => {
  const product = products[index];
  const image = card.querySelector('.product-image');
  const meta = card.querySelector('.product-meta');
  const labels = { new: 'NEW', low: '残りわずか', sold: 'SOLD OUT' };
  if (product.status) image.insertAdjacentHTML('afterbegin', `<span class="product-badge product-badge-${product.status}">${labels[product.status]}</span>`);
  meta.insertAdjacentHTML('afterend', `<span class="product-facts"><span>カラー ${card.dataset.color}</span><span>素材 ${product.material}</span></span>`);
  card.querySelector('.product-open').addEventListener('click', () => {
    window.location.href = `./product.html?id=${product.id}`;
  });
});

document.querySelectorAll('.demo-action, .pseudo-mercari').forEach((button) => {
  button.addEventListener('click', () => showToast(button.dataset.message || '販売URLは現在未設定です。'));
});
