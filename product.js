const id = new URLSearchParams(location.search).get('id') || 'color-mix';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const mainImage = $('#detail-image');
const thumbnails = $('#detail-thumbnails');
const colors = $('#color-options');
const toast = $('#toast');
let product;
let selectedColor = '';
let toastTimer;

const yen = (value) => Number(value) > 0 ? `¥${Number(value).toLocaleString('ja-JP')}` : '価格未設定';
function notify(message) { clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show'); toastTimer = setTimeout(() => toast.classList.remove('show'), 3200); }
function selectImage(url, label) {
  mainImage.classList.add('is-changing');
  mainImage.src = url;
  mainImage.alt = `${product.name} ${label}の商品写真`;
  $$('[data-image]').forEach((button) => button.classList.toggle('is-active', button.dataset.image === url));
  if (mainImage.complete) requestAnimationFrame(() => mainImage.classList.remove('is-changing'));
}
mainImage.addEventListener('load', () => mainImage.classList.remove('is-changing'));

function render() {
  document.title = `${product.name} | Lux Canis`;
  $('#product-title').textContent = product.name;
  $('.detail-price').textContent = yen(product.price);
  $('#detail-description').textContent = product.description || '商品説明は準備中です。';
  $('#detail-material').textContent = product.material || '未設定';
  $('#detail-fitting').textContent = product.fitting || '未設定';
  const stock = Number(product.stockQuantity || 0);
  $('#detail-stock').textContent = product.status === 'sold' ? '在庫なし' : stock > 0 ? `${stock}点` : '受注制作・在庫確認中';
  $('#detail-stock').className = product.status === 'sold' ? 'detail-stock-none' : stock <= 1 ? 'detail-stock-low' : '';
  const label = { new: 'NEW', low: '残りわずか', sold: 'SOLD OUT' }[product.status] || '';
  $('#detail-status').textContent = label; $('#detail-status').hidden = !label;
  thumbnails.innerHTML = '';
  const images = product.images?.length ? product.images : ['/icon.svg'];
  images.forEach((url, index) => {
    const button = document.createElement('button');
    const image = document.createElement('img');
    button.type = 'button';
    button.dataset.image = url;
    button.setAttribute('aria-label', `商品写真${index + 1}を見る`);
    image.src = url;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    button.append(image);
    button.addEventListener('click', () => selectImage(url, `写真${index + 1}`));
    thumbnails.append(button);
  });
  colors.innerHTML = '';
  const variants = product.variants?.length ? product.variants : (product.colors?.length ? product.colors.map((name, index) => ({ name, image: images[index] || images[0] })) : [{ name: 'カラー指定なし', image: images[0] }]);
  variants.forEach((variant, index) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = variant.name; button.setAttribute('aria-pressed', String(index === 0)); button.addEventListener('click', () => { selectedColor = variant.name; $$('#color-options button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); selectImage(variant.image || images[0], variant.name); }); colors.append(button); });
  selectedColor = variants[0]?.name || '';
  selectImage(variants[0]?.image || images[0], variants[0]?.name || 'メイン');
  const actions = $('#detail-actions');
  if (product.status === 'sold') actions.innerHTML = '<div class="sold-panel"><strong>現在こちらの商品は売り切れています</strong><p>再販されたときに確認できるよう、再販待ちへ登録できます。</p><button class="button button-dark" id="restock-action" type="button">再販待ちへ登録</button></div>';
  else if (product.salesUrl) {
    const link = document.createElement('a');
    actions.replaceChildren(link);
    link.className = 'button button-dark';
    link.href = product.salesUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '販売ページで見る・購入する →';
  }
  else actions.innerHTML = '<button class="button button-dark" id="sales-pending" type="button">販売ページは準備中です</button>';
  $('#sales-pending')?.addEventListener('click', () => notify('販売URLは現在未設定です。'));
  $('#restock-action')?.addEventListener('click', registerRestock);
}

async function registerRestock() {
  try {
    const response = await fetch('/api/restock', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: product.id, color: selectedColor }) });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { location.href = `./account.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    if (!response.ok) throw new Error(payload.error?.message || '登録できませんでした。');
    notify('再販待ちへ登録しました。マイページで確認できます。');
  } catch (error) { notify(error.message); }
}

async function load() {
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || '商品が見つかりません。');
    product = payload.product; render();
  } catch (error) {
    $('.product-detail').innerHTML = '<div class="sold-panel"><strong id="detail-load-error"></strong><p>商品一覧から、別の商品をご覧ください。</p><a class="button button-dark" href="./index.html#items">商品一覧へ戻る</a></div>';
    $('#detail-load-error').textContent = error.message;
  }
}
load();
