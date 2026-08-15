const state = { products: [], notices: [], contacts: [], customers: [], restock: [], metrics: {}, images: [], editingId: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#admin-app');
const gate = $('#login-gate');
const editor = $('#product-editor');
const productForm = $('#product-form');
const toast = $('#toast');
let toastTimer;

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const yen = (value) => Number(value) > 0 ? `¥${Number(value).toLocaleString('ja-JP')}` : '価格未設定';
const date = (value) => new Date(value).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, { credentials: 'same-origin', ...options, headers: options.body instanceof FormData ? options.headers : { 'content-type': 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== 'admin/login') showLogin();
    throw new Error(payload.error?.message || '処理に失敗しました。');
  }
  return payload;
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function setBusy(element, busy, label = '保存中…') {
  element.classList.toggle('loading', busy);
  const button = element.querySelector?.('[type="submit"]');
  if (button) {
    if (busy) button.dataset.original = button.textContent;
    button.textContent = busy ? label : button.dataset.original || button.textContent;
    button.disabled = busy;
  }
  $('#save-state').textContent = busy ? '保存中…' : '同期済み';
}

function showLogin() {
  app.hidden = true;
  gate.hidden = false;
  $('#admin-password').focus();
}

async function start() {
  try {
    const result = await api('admin/me', { headers: {} });
    if (!result.authenticated) return showLogin();
    gate.hidden = true;
    app.hidden = false;
    await loadAll();
  } catch (error) {
    $('#login-error').textContent = error.message;
    showLogin();
  }
}

$('#admin-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  $('#login-error').textContent = '';
  setBusy(form, true, '確認中…');
  try {
    await api('admin/login', { method: 'POST', body: JSON.stringify({ password: $('#admin-password').value }) });
    $('#admin-password').value = '';
    gate.hidden = true;
    app.hidden = false;
    await loadAll();
  } catch (error) {
    $('#login-error').textContent = error.message;
  } finally { setBusy(form, false); }
});

$('#toggle-admin-password').addEventListener('click', () => {
  const input = $('#admin-password');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('#toggle-admin-password').textContent = input.type === 'password' ? '表示' : '隠す';
});

$('#admin-logout').addEventListener('click', async () => {
  await api('admin/logout', { method: 'POST', body: '{}' }).catch(() => {});
  showLogin();
});

$$('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
function showView(name) {
  $$('.admin-view').forEach((view) => view.classList.toggle('is-active', view.id === `view-${name}`));
  $$('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === name));
  history.replaceState(null, '', `#${name}`);
}

async function loadAll() {
  $('#save-state').textContent = '同期中…';
  try {
    const [overview, products, notices, users, contacts, restock] = await Promise.all([
      api('admin/overview'), api('products?admin=1'), api('notices?admin=1'), api('admin/users'), api('contacts'), api('admin/restock')
    ]);
    state.metrics = overview.metrics;
    state.products = products.products;
    state.notices = notices.notices;
    state.customers = users.users;
    state.contacts = contacts.contacts;
    state.restock = restock.requests;
    renderAll();
    $('#save-state').textContent = '同期済み';
  } catch (error) {
    notify(error.message);
    $('#save-state').textContent = '同期エラー';
  }
}

function renderAll() {
  renderMetrics(); renderProducts(); renderNotices(); renderCustomers(); renderContacts(); renderRestock();
}

function renderMetrics() {
  const labels = [['products','公開商品'],['users','会員'],['contacts','未対応'],['restock','再販希望'],['notices','公開お知らせ']];
  $('#metric-grid').innerHTML = labels.map(([key, label]) => `<article class="metric-card"><span>${label}</span><strong>${Number(state.metrics[key] || 0).toLocaleString('ja-JP')}</strong></article>`).join('');
  $('#metric-grid').setAttribute('aria-busy', 'false');
  const actions = [];
  if (state.metrics.contacts) actions.push(['未対応の問い合わせがあります', `${state.metrics.contacts}件`]);
  if (state.products.some((item) => item.price === 0)) actions.push(['価格未設定の商品があります', `${state.products.filter((item) => item.price === 0).length}件`]);
  if (state.products.some((item) => !item.images.length)) actions.push(['写真のない商品があります', `${state.products.filter((item) => !item.images.length).length}件`]);
  $('#action-list').innerHTML = actions.length ? actions.map(([label, count]) => `<div class="action-row"><strong>${label}</strong><span>${count}</span></div>`).join('') : '<div class="action-row"><strong>現在、優先対応はありません</strong><span>良好</span></div>';
}

function statusLabel(status) { return ({ new: 'NEW', low: '残りわずか', sold: 'SOLD OUT', available: '販売中' })[status] || '販売中'; }
function renderProducts() {
  const query = $('#product-search').value.trim().toLowerCase();
  const list = state.products.filter((item) => item.name.toLowerCase().includes(query));
  $('#product-count').textContent = `${list.length}件`;
  $('#product-admin-list').innerHTML = list.length ? list.map((product) => `<article class="product-admin-row">
    <img class="admin-thumb" src="${esc(product.images[0] || '/icon.svg')}" alt="">
    <div class="product-copy"><strong>${esc(product.name)}</strong><small>${esc(product.category === 'ear' ? 'ピアス・イヤリング' : product.category === 'bracelet' ? 'ブレスレット' : 'その他')}</small></div>
    <strong class="price-cell">${yen(product.price)}</strong><span class="status-pill ${esc(product.status)}">${statusLabel(product.status)}</span>
    <span class="${product.published ? 'published' : 'unpublished'}">${product.published ? '公開中' : '非公開'}</span>
    <div class="row-actions"><button class="icon-button" type="button" data-edit-product="${esc(product.id)}" aria-label="${esc(product.name)}を編集">編集</button></div>
  </article>`).join('') : '<div class="empty-card">該当する商品はありません。</div>';
  $$('[data-edit-product]').forEach((button) => button.addEventListener('click', () => openEditor(state.products.find((item) => item.id === button.dataset.editProduct))));
  const select = $('#notice-product');
  const selected = select.value;
  select.innerHTML = '<option value="">指定なし</option>' + state.products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  select.value = selected;
}
$('#product-search').addEventListener('input', renderProducts);

function renderNotices() {
  const typeLabel = { news: '新作', restock: '再販', color: '新色', important: '重要' };
  $('#notice-admin-list').innerHTML = state.notices.length ? state.notices.map((notice) => `<article class="list-card"><header><div><span class="status-pill">${typeLabel[notice.type] || 'お知らせ'}</span><h3>${esc(notice.title)}</h3></div><button class="icon-button" type="button" data-delete-notice="${esc(notice.id)}" aria-label="削除">削除</button></header><p>${esc(notice.body)}</p><footer><span>${date(notice.created_at)}</span><span>${notice.published ? '公開中' : '下書き'}</span></footer></article>`).join('') : '<div class="empty-card">お知らせはまだありません。</div>';
  $$('[data-delete-notice]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('このお知らせを削除しますか？')) return;
    try { await api(`notices/${button.dataset.deleteNotice}`, { method: 'DELETE', body: '{}' }); await loadAll(); notify('お知らせを削除しました。'); } catch (error) { notify(error.message); }
  }));
}

function renderCustomers() {
  $('#customer-list').innerHTML = state.customers.length ? '<div class="data-row head"><span>会員名</span><span>メール</span><span>通知希望</span><span>登録日</span></div>' + state.customers.map((user) => {
    const prefs = user.preferences || {};
    const count = ['newItems','restock','newColors','email'].filter((key) => prefs[key]).length;
    return `<div class="data-row"><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span><span>${count}項目</span><span>${date(user.created_at)}</span></div>`;
  }).join('') : '<div class="empty-card">会員登録はまだありません。</div>';
}

function renderContacts() {
  const status = { unread: '未対応', working: '対応中', done: '完了' };
  $('#contact-list').innerHTML = state.contacts.length ? state.contacts.map((contact) => `<article class="list-card contact-card"><div><span class="status-pill ${esc(contact.status)}">${status[contact.status]}</span><small class="muted">${date(contact.created_at)}</small></div><div><h3>${esc(contact.name)} / ${esc(contact.type)}</h3><p>${esc(contact.message)}</p><small class="muted">${esc(contact.email)}</small></div><select data-contact-status="${esc(contact.id)}" aria-label="対応状況"><option value="unread" ${contact.status === 'unread' ? 'selected' : ''}>未対応</option><option value="working" ${contact.status === 'working' ? 'selected' : ''}>対応中</option><option value="done" ${contact.status === 'done' ? 'selected' : ''}>完了</option></select></article>`).join('') : '<div class="empty-card">問い合わせはまだありません。</div>';
  $$('[data-contact-status]').forEach((select) => select.addEventListener('change', async () => {
    try { await api(`contacts/${select.dataset.contactStatus}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await loadAll(); notify('対応状況を更新しました。'); } catch (error) { notify(error.message); }
  }));
}

function renderRestock() {
  $('#restock-admin-list').innerHTML = state.restock.length ? '<div class="data-row head"><span>商品</span><span>会員</span><span>カラー</span><span>登録日</span></div>' + state.restock.map((item) => `<div class="data-row"><strong>${esc(item.product_name)}</strong><span>${esc(item.user_name)}<br><small>${esc(item.email)}</small></span><span>${esc(item.color || '指定なし')}</span><span>${date(item.created_at)}</span></div>`).join('') : '<div class="empty-card">再販希望はまだありません。</div>';
}

$$('[data-new-product]').forEach((button) => button.addEventListener('click', () => openEditor()));
$$('[data-close-editor]').forEach((button) => button.addEventListener('click', () => editor.close()));
editor.addEventListener('click', (event) => { if (event.target === editor) editor.close(); });

function openEditor(product = null) {
  state.editingId = product?.id || null;
  state.images = [...(product?.images || [])];
  productForm.reset();
  productForm.elements.id.value = product?.id || '';
  productForm.elements.name.value = product?.name || '';
  productForm.elements.price.value = product?.price ?? 0;
  productForm.elements.sortOrder.value = product?.sortOrder ?? state.products.length * 10 + 10;
  productForm.elements.category.value = product?.category || 'ear';
  productForm.elements.status.value = product?.status || 'available';
  productForm.elements.colors.value = (product?.colors || []).join(', ');
  productForm.elements.material.value = product?.material || '';
  productForm.elements.fitting.value = product?.fitting || '';
  productForm.elements.description.value = product?.description || '';
  productForm.elements.salesUrl.value = product?.salesUrl || '';
  productForm.elements.published.checked = product ? product.published : true;
  $('#editor-title').textContent = product ? '商品を編集' : '商品を追加';
  $('#delete-product').hidden = !product;
  $('#product-images').value = '';
  renderImagePreviews();
  editor.showModal();
}

function renderImagePreviews() {
  $('#image-preview-grid').innerHTML = state.images.map((url, index) => `<figure class="image-preview"><img src="${esc(url)}" alt="商品写真${index + 1}"><button type="button" data-remove-image="${index}" aria-label="写真${index + 1}を削除">×</button></figure>`).join('');
  $$('[data-remove-image]').forEach((button) => button.addEventListener('click', () => { state.images.splice(Number(button.dataset.removeImage), 1); renderImagePreviews(); }));
}

async function uploadImages() {
  const files = [...$('#product-images').files];
  if (state.images.length + files.length > 12) throw new Error('商品写真は最大12枚です。');
  for (const file of files) {
    const form = new FormData(); form.append('file', file);
    const result = await api('images', { method: 'POST', body: form });
    state.images.push(result.url);
  }
}

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(productForm, true);
  try {
    await uploadImages();
    const data = Object.fromEntries(new FormData(productForm));
    const payload = {
      name: data.name, price: Number(data.price), sortOrder: Number(data.sortOrder), category: data.category, status: data.status,
      colors: data.colors.split(',').map((item) => item.trim()).filter(Boolean), material: data.material, fitting: data.fitting,
      description: data.description, salesUrl: data.salesUrl, published: productForm.elements.published.checked, images: state.images
    };
    await api(state.editingId ? `products/${state.editingId}` : 'products', { method: state.editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    editor.close();
    await loadAll();
    notify('商品を保存し、公開サイトへ反映しました。');
  } catch (error) { notify(error.message); renderImagePreviews(); } finally { setBusy(productForm, false); }
});

$('#delete-product').addEventListener('click', async () => {
  const product = state.products.find((item) => item.id === state.editingId);
  if (!product || !confirm(`「${product.name}」を完全に削除します。元に戻せません。よろしいですか？`)) return;
  try { await api(`products/${product.id}`, { method: 'DELETE', body: '{}' }); editor.close(); await loadAll(); notify('商品を削除しました。'); } catch (error) { notify(error.message); }
});

$('#notice-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setBusy(form, true);
  try {
    const data = Object.fromEntries(new FormData(form));
    await api('notices', { method: 'POST', body: JSON.stringify({ ...data, published: form.elements.published.checked }) });
    form.reset(); form.elements.published.checked = true;
    await loadAll(); notify('お知らせを追加しました。');
  } catch (error) { notify(error.message); } finally { setBusy(form, false); }
});

window.addEventListener('hashchange', () => { const name = location.hash.slice(1); if ($(`[data-view="${name}"]`)) showView(name); });
start().then(() => { const name = location.hash.slice(1); if ($(`[data-view="${name}"]`)) showView(name); });
