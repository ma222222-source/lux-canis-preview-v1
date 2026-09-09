const state = { products: [], notices: [], contacts: [], customers: [], restock: [], metrics: {}, images: [], variants: [], pendingFiles: new Map(), editingId: null, editingNoticeId: null, editorDirty: false };
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
  if (state.metrics.contacts) actions.push(`<div class="action-row"><div><strong>未対応の問い合わせがあります</strong><small>${state.metrics.contacts}件</small></div><button class="button button-ghost action-button" type="button" data-action-view="contacts">確認する</button></div>`);
  state.products.forEach((item) => {
    const issues = [];
    if (item.price === 0) issues.push('価格');
    if (!item.images.length) issues.push('写真');
    if (item.status !== 'sold' && item.stockQuantity === 0) issues.push('在庫数');
    if (!issues.length) return;
    actions.push(`<div class="action-row"><div><strong>${esc(item.name)}</strong><small>${issues.join('・')}が未設定です</small></div><button class="button button-ghost action-button" type="button" data-fix-product="${esc(item.id)}">編集する</button></div>`);
  });
  $('#action-list').innerHTML = actions.length ? actions.join('') : '<div class="action-row action-good"><div><strong>現在、優先対応はありません</strong><small>公開準備は整っています</small></div><span>良好</span></div>';
  $$('[data-action-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.actionView)));
  $$('[data-fix-product]').forEach((button) => button.addEventListener('click', () => {
    const product = state.products.find((item) => item.id === button.dataset.fixProduct);
    if (!product) return;
    showView('products');
    openEditor(product);
  }));
}

function statusLabel(status) { return ({ new: 'NEW', low: '残りわずか', sold: 'SOLD OUT', available: '販売中' })[status] || '販売中'; }
function renderProducts() {
  const query = $('#product-search').value.trim().toLowerCase();
  const list = state.products.filter((item) => item.name.toLowerCase().includes(query));
  $('#product-count').textContent = `${list.length}件`;
  $('#product-admin-list').innerHTML = list.length ? list.map((product) => `<article class="product-admin-row">
    <img class="admin-thumb" src="${esc(product.images[0] || '/icon.svg')}" alt="${esc(product.name)}の商品写真" loading="lazy" decoding="async">
    <div class="product-copy"><strong>${esc(product.name)}</strong><small>${esc(({ ear: 'ピアス・イヤリング', bracelet: 'ブレスレット', necklace: 'ネックレス', charm: 'チャーム', other: 'その他' })[product.category] || 'その他')} ・ 在庫${Number(product.stockQuantity || 0)}点</small></div>
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
  $('#notice-admin-list').innerHTML = state.notices.length ? state.notices.map((notice) => `<article class="list-card"><header><div><span class="status-pill">${typeLabel[notice.type] || 'お知らせ'}</span><h3>${esc(notice.title)}</h3></div><div class="notice-row-actions"><button class="icon-button" type="button" data-edit-notice="${esc(notice.id)}" aria-label="${esc(notice.title)}を編集">編集</button><button class="icon-button" type="button" data-delete-notice="${esc(notice.id)}" aria-label="${esc(notice.title)}を削除">削除</button></div></header><p>${esc(notice.body)}</p><footer><span>${date(notice.created_at)}</span><span>${notice.published ? '公開中' : '下書き'}</span></footer></article>`).join('') : '<div class="empty-card">お知らせはまだありません。</div>';
  $$('[data-edit-notice]').forEach((button) => button.addEventListener('click', () => editNotice(button.dataset.editNotice)));
  $$('[data-delete-notice]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('このお知らせを削除しますか？')) return;
    try { await api(`notices/${button.dataset.deleteNotice}`, { method: 'DELETE', body: '{}' }); if (state.editingNoticeId === button.dataset.deleteNotice) resetNoticeForm(); await loadAll(); notify('お知らせを削除しました。'); } catch (error) { notify(error.message); }
  }));
}

function renderCustomers() {
  $('#customer-list').innerHTML = state.customers.length ? '<div class="data-row head"><span>会員名</span><span>メール</span><span>通知希望</span><span>登録日</span></div>' + state.customers.map((user) => {
    const prefs = user.preferences || {};
    const labels = [['newItems','新作'],['restock','再販'],['newColors','新色'],['email','メール']].filter(([key]) => prefs[key]).map(([,label]) => label);
    const consent = prefs.privacyAcceptedAt ? `同意済み ${date(prefs.privacyAcceptedAt)}` : '同意記録なし';
    return `<div class="data-row"><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span><span>${labels.length ? esc(labels.join('・')) : '希望なし'}<small class="muted">${esc(consent)}</small></span><span>${date(user.created_at)}</span></div>`;
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
$$('[data-close-editor]').forEach((button) => button.addEventListener('click', requestCloseEditor));
editor.addEventListener('click', (event) => { if (event.target === editor) requestCloseEditor(); });

function discardPendingImages() {
  for (const url of state.pendingFiles.keys()) URL.revokeObjectURL(url);
  state.pendingFiles.clear();
}

function requestCloseEditor() {
  if (state.editorDirty && !confirm('保存していない変更があります。閉じてもよろしいですか？')) return;
  discardPendingImages();
  state.editorDirty = false;
  editor.close();
}

function openEditor(product = null) {
  state.editingId = product?.id || null;
  state.images = [...(product?.images || [])];
  discardPendingImages();
  state.variants = (product?.variants?.length ? product.variants : (product?.colors || []).map((name, index) => ({ name, image: state.images[index] || state.images[0] || '' }))).map((variant) => ({ ...variant }));
  productForm.reset();
  productForm.elements.id.value = product?.id || '';
  productForm.elements.name.value = product?.name || '';
  productForm.elements.price.value = product?.price ?? 0;
  productForm.elements.stockQuantity.value = product?.stockQuantity ?? 0;
  productForm.elements.sortOrder.value = product?.sortOrder ?? state.products.length * 10 + 10;
  productForm.elements.category.value = product?.category || 'ear';
  productForm.elements.status.value = product?.status || 'available';
  productForm.elements.material.value = product?.material || '';
  productForm.elements.fitting.value = product?.fitting || '';
  productForm.elements.description.value = product?.description || '';
  productForm.elements.salesUrl.value = product?.salesUrl || '';
  productForm.elements.published.checked = product ? product.published : true;
  $('#editor-title').textContent = product ? '商品を編集' : '商品を追加';
  $('#delete-product').hidden = !product;
  $('#product-images').value = '';
  renderImagePreviews();
  renderVariantEditor();
  state.editorDirty = false;
  editor.showModal();
}

function renderImagePreviews() {
  $('#image-preview-grid').innerHTML = state.images.map((url, index) => `<figure class="image-preview"><img src="${esc(url)}" alt="商品写真${index + 1}"><span class="image-number">${index === 0 ? 'メイン写真' : `写真${index + 1}`}</span><div class="image-preview-actions">${index > 0 ? `<button class="photo-action" type="button" data-make-cover="${index}">メインにする</button>` : ''}<button class="photo-action is-danger" type="button" data-remove-image="${index}">削除</button></div></figure>`).join('');
  $$('[data-remove-image]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.removeImage);
    const removed = state.images[index];
    if (state.pendingFiles.has(removed)) { URL.revokeObjectURL(removed); state.pendingFiles.delete(removed); }
    state.images.splice(index, 1);
    state.variants.forEach((variant) => { if (variant.image === removed) variant.image = state.images[0] || ''; });
    state.editorDirty = true; renderImagePreviews(); renderVariantEditor();
  }));
  $$('[data-make-cover]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.makeCover);
    const [image] = state.images.splice(index, 1); state.images.unshift(image);
    state.editorDirty = true; renderImagePreviews(); renderVariantEditor();
  }));
}

function renderVariantEditor() {
  const root = $('#variant-editor');
  const imageOptions = state.images.map((url, index) => `<option value="${esc(url)}">${index === 0 ? 'メイン写真' : `写真${index + 1}`}</option>`).join('');
  root.innerHTML = state.variants.length ? state.variants.map((variant, index) => `<div class="variant-row"><label>カラー名<input data-variant-name="${index}" value="${esc(variant.name)}" maxlength="100" placeholder="例：Pink"></label><label>表示する写真<select data-variant-image="${index}" ${state.images.length ? '' : 'disabled'}>${state.images.length ? imageOptions : '<option>先に写真を追加してください</option>'}</select></label><button class="variant-remove" type="button" data-remove-variant="${index}" aria-label="このカラーを削除">削除</button></div>`).join('') : '<p class="variant-empty">カラーがある商品は「カラーを追加」から登録してください。</p>';
  $$('[data-variant-image]').forEach((select) => { select.value = state.variants[Number(select.dataset.variantImage)].image || state.images[0] || ''; select.addEventListener('change', () => { state.variants[Number(select.dataset.variantImage)].image = select.value; state.editorDirty = true; }); });
  $$('[data-variant-name]').forEach((input) => input.addEventListener('input', () => { state.variants[Number(input.dataset.variantName)].name = input.value; state.editorDirty = true; }));
  $$('[data-remove-variant]').forEach((button) => button.addEventListener('click', () => { state.variants.splice(Number(button.dataset.removeVariant), 1); state.editorDirty = true; renderVariantEditor(); }));
}

$('#add-variant').addEventListener('click', () => { state.variants.push({ name: '', image: state.images[0] || '' }); state.editorDirty = true; renderVariantEditor(); $('#variant-editor input:last-of-type')?.focus(); });

$('#product-images').addEventListener('change', (event) => {
  const files = [...event.target.files];
  if (state.images.length + files.length > 12) { notify('商品写真は最大12枚です。'); event.target.value = ''; return; }
  for (const file of files) {
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) { notify('JPG・PNG・WebP・GIFの5MB以下の画像を選択してください。'); continue; }
    const url = URL.createObjectURL(file); state.pendingFiles.set(url, file); state.images.push(url);
  }
  if (!state.variants.length && state.images.length) state.variants.push({ name: '', image: state.images[0] });
  state.editorDirty = true; event.target.value = ''; renderImagePreviews(); renderVariantEditor();
});

async function uploadImages() {
  for (let index = 0; index < state.images.length; index += 1) {
    const temporaryUrl = state.images[index];
    const file = state.pendingFiles.get(temporaryUrl);
    if (!file) continue;
    const form = new FormData(); form.append('file', file);
    const result = await api('images', { method: 'POST', body: form });
    state.images[index] = result.url;
    state.variants.forEach((variant) => { if (variant.image === temporaryUrl) variant.image = result.url; });
    URL.revokeObjectURL(temporaryUrl); state.pendingFiles.delete(temporaryUrl);
  }
}

productForm.addEventListener('input', () => { state.editorDirty = true; });
productForm.addEventListener('change', () => { state.editorDirty = true; });

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(productForm, true);
  try {
    await uploadImages();
    const data = Object.fromEntries(new FormData(productForm));
    const payload = {
      name: data.name, price: Number(data.price), sortOrder: Number(data.sortOrder), category: data.category, status: data.status,
      stockQuantity: Number(data.stockQuantity), variants: state.variants.map((variant) => ({ name: variant.name.trim(), image: variant.image })).filter((variant) => variant.name), material: data.material, fitting: data.fitting,
      description: data.description, salesUrl: data.salesUrl, published: productForm.elements.published.checked, images: state.images
    };
    await api(state.editingId ? `products/${state.editingId}` : 'products', { method: state.editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    state.editorDirty = false;
    editor.close();
    await loadAll();
    notify('商品を保存し、公開サイトへ反映しました。');
  } catch (error) { notify(error.message); renderImagePreviews(); renderVariantEditor(); } finally { setBusy(productForm, false); }
});

$('#delete-product').addEventListener('click', async () => {
  const product = state.products.find((item) => item.id === state.editingId);
  if (!product || !confirm(`「${product.name}」を完全に削除します。元に戻せません。よろしいですか？`)) return;
  try { await api(`products/${product.id}`, { method: 'DELETE', body: '{}' }); state.editorDirty = false; discardPendingImages(); editor.close(); await loadAll(); notify('商品を削除しました。'); } catch (error) { notify(error.message); }
});

function resetNoticeForm() {
  const form = $('#notice-form');
  state.editingNoticeId = null;
  form.reset();
  form.elements.published.checked = true;
  $('#notice-form-title').textContent = '新しいお知らせ';
  $('#notice-submit').textContent = 'お知らせを追加';
  $('#notice-cancel').hidden = true;
}

function editNotice(id) {
  const notice = state.notices.find((item) => item.id === id);
  if (!notice) return;
  const form = $('#notice-form');
  state.editingNoticeId = id;
  form.elements.type.value = notice.type;
  form.elements.title.value = notice.title;
  form.elements.body.value = notice.body;
  form.elements.productId.value = notice.product_id || '';
  form.elements.published.checked = Boolean(notice.published);
  $('#notice-form-title').textContent = 'お知らせを編集';
  $('#notice-submit').textContent = '変更を保存';
  $('#notice-cancel').hidden = false;
  form.elements.title.focus();
}

$('#notice-cancel').addEventListener('click', resetNoticeForm);

$('#notice-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setBusy(form, true);
  try {
    const data = Object.fromEntries(new FormData(form));
    const editing = state.editingNoticeId;
    await api(editing ? `notices/${editing}` : 'notices', { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...data, published: form.elements.published.checked }) });
    resetNoticeForm();
    await loadAll(); notify(editing ? 'お知らせを更新しました。' : 'お知らせを追加しました。');
  } catch (error) { notify(error.message); } finally { setBusy(form, false); }
});

window.addEventListener('hashchange', () => { const name = location.hash.slice(1); if ($(`[data-view="${name}"]`)) showView(name); });
start().then(() => { const name = location.hash.slice(1); if ($(`[data-view="${name}"]`)) showView(name); });
