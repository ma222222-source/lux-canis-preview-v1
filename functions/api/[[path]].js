const USER_COOKIE = 'lux_session';
const ADMIN_COOKIE = 'lux_admin_session';
const USER_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif']
]);

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});

const fail = (message, status = 400, code = 'BAD_REQUEST') => json({ ok: false, error: { code, message } }, status);

function parseCookies(request) {
  const entries = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  });
  return Object.fromEntries(entries);
}

function cookie(name, value, seconds) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}

const clearCookie = (name) => `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function randomHex(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function passwordHash(password, saltBase64) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltBase64), iterations: 100000 }, material, 256);
  return bytesToBase64(new Uint8Array(bits));
}

async function safeEqual(left, right) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(left)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(right))
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) throw new Error('JSON形式で送信してください。');
  return request.json();
}

function cleanText(value, max, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error('必須項目が入力されていません。');
  if (text.length > max) throw new Error(`${max}文字以内で入力してください。`);
  return text;
}

function cleanEmail(value) {
  const email = cleanText(value, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('メールアドレスの形式を確認してください。');
  return email;
}

function cleanUrl(value) {
  const text = cleanText(value, 500);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error('販売URLは http または https で始まる正しいURLを入力してください。');
  }
}

function parseList(value, maxItems = 12) {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, maxItems).map((item) => cleanText(item, 500)).filter(Boolean);
}

function mapProduct(row) {
  const images = JSON.parse(row.images || '[]');
  const colors = JSON.parse(row.colors || '[]');
  const savedVariants = JSON.parse(row.variants || '[]');
  const variants = savedVariants.length ? savedVariants : colors.map((name, index) => ({ name, image: images[index] || images[0] || '' }));
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    category: row.category,
    colors: variants.map((variant) => variant.name),
    variants,
    material: row.material,
    fitting: row.fitting,
    description: row.description,
    status: row.status,
    published: Boolean(row.published),
    images,
    stockQuantity: Number(row.stock_quantity || 0),
    salesUrl: row.sales_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, preferences: JSON.parse(row.preferences || '{}'), createdAt: row.created_at };
}

async function createSession(env, kind, userId = null) {
  const token = randomHex();
  const tokenHash = await sha256(token);
  const seconds = kind === 'admin' ? ADMIN_SESSION_HOURS * 3600 : USER_SESSION_DAYS * 86400;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + seconds * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, kind, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(tokenHash, userId, kind, expiresAt, now.toISOString()).run();
  return { token, seconds };
}

async function getSession(request, env, kind) {
  const name = kind === 'admin' ? ADMIN_COOKIE : USER_COOKIE;
  const token = parseCookies(request)[name];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`SELECT sessions.*, users.name, users.email, users.preferences, users.active, users.created_at AS user_created_at
    FROM sessions LEFT JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.kind = ? AND sessions.expires_at > ?`).bind(tokenHash, kind, new Date().toISOString()).first();
  if (!row || (kind === 'user' && !row.active)) return null;
  return { ...row, tokenHash };
}

async function requireSession(request, env, kind) {
  const session = await getSession(request, env, kind);
  if (!session) throw Object.assign(new Error(kind === 'admin' ? '管理者ログインが必要です。' : 'ログインが必要です。'), { status: 401, code: 'UNAUTHORIZED' });
  return session;
}

function productInput(data) {
  const status = ['new', 'low', 'sold', 'available'].includes(data.status) ? data.status : 'available';
  const category = ['ear', 'bracelet', 'other'].includes(data.category) ? data.category : 'other';
  const price = Number(data.price);
  const sortOrder = Number(data.sortOrder);
  const stockQuantity = Number(data.stockQuantity);
  const images = parseList(data.images, 12);
  const fallbackColors = parseList(data.colors, 20);
  const rawVariants = Array.isArray(data.variants) ? data.variants : fallbackColors.map((name, index) => ({ name, image: images[index] || images[0] || '' }));
  const seenNames = new Set();
  const variants = rawVariants.slice(0, 20).map((variant) => {
    const name = cleanText(variant?.name, 100);
    const requestedImage = cleanText(variant?.image, 500);
    return { name, image: images.includes(requestedImage) ? requestedImage : images[0] || '' };
  }).filter((variant) => {
    const key = variant.name.toLocaleLowerCase('ja');
    if (!variant.name || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
  return {
    name: cleanText(data.name, 100, true),
    price: Number.isInteger(price) && price >= 0 && price <= 10000000 ? price : 0,
    category,
    colors: variants.map((variant) => variant.name),
    variants,
    material: cleanText(data.material, 200),
    fitting: cleanText(data.fitting, 200),
    description: cleanText(data.description, 2000),
    status,
    published: data.published === false ? 0 : 1,
    images,
    stockQuantity: Number.isInteger(stockQuantity) && stockQuantity >= 0 && stockQuantity <= 100000 ? stockQuantity : 0,
    salesUrl: cleanUrl(data.salesUrl),
    sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0
  };
}

function r2KeyFromUrl(value) {
  const prefix = '/api/images/';
  return value.startsWith(prefix) ? decodeURIComponent(value.slice(prefix.length)) : null;
}

async function handleImages(context, path) {
  const { request, env } = context;
  if (request.method === 'GET' && path.length === 2) {
    const key = decodeURIComponent(path[1]);
    if (!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(key)) return fail('画像が見つかりません。', 404, 'NOT_FOUND');
    const object = await env.PRODUCT_IMAGES.get(key);
    if (!object) return fail('画像が見つかりません。', 404, 'NOT_FOUND');
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    headers.set('x-content-type-options', 'nosniff');
    return new Response(object.body, { headers });
  }
  if (request.method === 'POST' && path.length === 1) {
    await requireSession(request, env, 'admin');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail('画像を選択してください。');
    if (!IMAGE_TYPES.has(file.type)) return fail('JPG・PNG・WebP・GIF画像を選択してください。');
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return fail('画像は1枚5MB以下にしてください。');
    const key = `${crypto.randomUUID()}.${IMAGE_TYPES.get(file.type)}`;
    await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
    return json({ ok: true, url: `/api/images/${key}` }, 201);
  }
  return fail('見つかりません。', 404, 'NOT_FOUND');
}

async function handleAuth(context, path) {
  const { request, env } = context;
  const action = path[1];
  if (request.method === 'POST' && action === 'register') {
    const data = await readJson(request);
    const name = cleanText(data.name, 80, true);
    const email = cleanEmail(data.email);
    const password = cleanText(data.password, 200, true);
    if (password.length < 8) return fail('パスワードは8文字以上にしてください。');
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return fail('このメールアドレスは登録済みです。', 409, 'ALREADY_EXISTS');
    const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await passwordHash(password, salt);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO users (id, name, email, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, name, email, hash, salt, now, now).run();
    const session = await createSession(env, 'user', id);
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    return json({ ok: true, user: publicUser(row) }, 201, { 'set-cookie': cookie(USER_COOKIE, session.token, session.seconds) });
  }
  if (request.method === 'POST' && action === 'login') {
    const data = await readJson(request);
    const email = cleanEmail(data.email);
    const password = cleanText(data.password, 200, true);
    const row = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND active = 1').bind(email).first();
    if (!row || !await safeEqual(await passwordHash(password, row.password_salt), row.password_hash)) return fail('メールアドレスまたはパスワードが違います。', 401, 'INVALID_CREDENTIALS');
    const session = await createSession(env, 'user', row.id);
    return json({ ok: true, user: publicUser(row) }, 200, { 'set-cookie': cookie(USER_COOKIE, session.token, session.seconds) });
  }
  if (request.method === 'POST' && action === 'logout') {
    const session = await getSession(request, env, 'user');
    if (session) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash).run();
    return json({ ok: true }, 200, { 'set-cookie': clearCookie(USER_COOKIE) });
  }
  if (request.method === 'GET' && action === 'me') {
    const session = await getSession(request, env, 'user');
    if (!session) return json({ ok: true, user: null });
    return json({ ok: true, user: { id: session.user_id, name: session.name, email: session.email, preferences: JSON.parse(session.preferences || '{}'), createdAt: session.user_created_at } });
  }
  if (request.method === 'PUT' && action === 'preferences') {
    const session = await requireSession(request, env, 'user');
    const data = await readJson(request);
    const preferences = {
      newItems: Boolean(data.newItems), restock: Boolean(data.restock), newColors: Boolean(data.newColors), email: Boolean(data.email)
    };
    await env.DB.prepare('UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(preferences), new Date().toISOString(), session.user_id).run();
    return json({ ok: true, preferences });
  }
  return fail('見つかりません。', 404, 'NOT_FOUND');
}

async function handleAdmin(context, path) {
  const { request, env } = context;
  const action = path[1];
  if (request.method === 'POST' && action === 'login') {
    const data = await readJson(request);
    const password = cleanText(data.password, 200, true);
    if (!env.ADMIN_PASSWORD) return fail('管理者パスワードが設定されていません。', 503, 'NOT_CONFIGURED');
    if (!await safeEqual(password, env.ADMIN_PASSWORD)) return fail('パスワードが違います。', 401, 'INVALID_CREDENTIALS');
    const session = await createSession(env, 'admin');
    return json({ ok: true }, 200, { 'set-cookie': cookie(ADMIN_COOKIE, session.token, session.seconds) });
  }
  if (request.method === 'POST' && action === 'logout') {
    const session = await getSession(request, env, 'admin');
    if (session) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash).run();
    return json({ ok: true }, 200, { 'set-cookie': clearCookie(ADMIN_COOKIE) });
  }
  if (request.method === 'GET' && action === 'me') {
    return json({ ok: true, authenticated: Boolean(await getSession(request, env, 'admin')) });
  }
  await requireSession(request, env, 'admin');
  if (request.method === 'GET' && action === 'overview') {
    const [products, users, contacts, restock, notices] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS count FROM products WHERE published = 1'),
      env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE active = 1'),
      env.DB.prepare("SELECT COUNT(*) AS count FROM contacts WHERE status = 'unread'"),
      env.DB.prepare('SELECT COUNT(*) AS count FROM restock_requests'),
      env.DB.prepare('SELECT COUNT(*) AS count FROM notices WHERE published = 1')
    ]);
    return json({ ok: true, metrics: { products: products.results[0].count, users: users.results[0].count, contacts: contacts.results[0].count, restock: restock.results[0].count, notices: notices.results[0].count } });
  }
  if (request.method === 'GET' && action === 'users') {
    const result = await env.DB.prepare('SELECT id, name, email, active, preferences, created_at FROM users ORDER BY created_at DESC LIMIT 500').all();
    return json({ ok: true, users: result.results.map((row) => ({ ...row, active: Boolean(row.active), preferences: JSON.parse(row.preferences || '{}') })) });
  }
  if (request.method === 'GET' && action === 'restock') {
    const result = await env.DB.prepare(`SELECT restock_requests.id, restock_requests.color, restock_requests.created_at,
      users.name AS user_name, users.email, products.name AS product_name, products.id AS product_id
      FROM restock_requests JOIN users ON users.id = restock_requests.user_id JOIN products ON products.id = restock_requests.product_id
      ORDER BY restock_requests.created_at DESC LIMIT 1000`).all();
    return json({ ok: true, requests: result.results });
  }
  return fail('見つかりません。', 404, 'NOT_FOUND');
}

async function handleProducts(context, path) {
  const { request, env } = context;
  if (request.method === 'GET' && path.length === 1) {
    const admin = new URL(request.url).searchParams.get('admin') === '1';
    if (admin) await requireSession(request, env, 'admin');
    const result = await env.DB.prepare(`SELECT * FROM products ${admin ? '' : 'WHERE published = 1'} ORDER BY sort_order ASC, created_at DESC`).all();
    return json({ ok: true, products: result.results.map(mapProduct) });
  }
  if (request.method === 'GET' && path.length === 2) {
    const row = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND published = 1').bind(path[1]).first();
    return row ? json({ ok: true, product: mapProduct(row) }) : fail('商品が見つかりません。', 404, 'NOT_FOUND');
  }
  await requireSession(request, env, 'admin');
  if (request.method === 'POST' && path.length === 1) {
    const input = productInput(await readJson(request));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO products (id, name, price, category, colors, variants, material, fitting, description, status, published, images, stock_quantity, sales_url, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.name, input.price, input.category, JSON.stringify(input.colors), JSON.stringify(input.variants), input.material, input.fitting, input.description, input.status, input.published, JSON.stringify(input.images), input.stockQuantity, input.salesUrl, input.sortOrder, now, now).run();
    const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    return json({ ok: true, product: mapProduct(row) }, 201);
  }
  if (path.length !== 2) return fail('見つかりません。', 404, 'NOT_FOUND');
  const current = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(path[1]).first();
  if (!current) return fail('商品が見つかりません。', 404, 'NOT_FOUND');
  if (request.method === 'PUT') {
    const input = productInput(await readJson(request));
    await env.DB.prepare(`UPDATE products SET name = ?, price = ?, category = ?, colors = ?, variants = ?, material = ?, fitting = ?, description = ?, status = ?, published = ?, images = ?, stock_quantity = ?, sales_url = ?, sort_order = ?, updated_at = ? WHERE id = ?`)
      .bind(input.name, input.price, input.category, JSON.stringify(input.colors), JSON.stringify(input.variants), input.material, input.fitting, input.description, input.status, input.published, JSON.stringify(input.images), input.stockQuantity, input.salesUrl, input.sortOrder, new Date().toISOString(), path[1]).run();
    const oldImages = JSON.parse(current.images || '[]');
    const removedKeys = oldImages.filter((url) => !input.images.includes(url)).map(r2KeyFromUrl).filter(Boolean);
    if (removedKeys.length) await env.PRODUCT_IMAGES.delete(removedKeys);
    const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(path[1]).first();
    return json({ ok: true, product: mapProduct(row) });
  }
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(path[1]).run();
    const keys = JSON.parse(current.images || '[]').map(r2KeyFromUrl).filter(Boolean);
    if (keys.length) await env.PRODUCT_IMAGES.delete(keys);
    return json({ ok: true });
  }
  return fail('見つかりません。', 404, 'NOT_FOUND');
}

async function handleNotices(context, path) {
  const { request, env } = context;
  if (request.method === 'GET' && path.length === 1) {
    const admin = new URL(request.url).searchParams.get('admin') === '1';
    if (admin) await requireSession(request, env, 'admin');
    const result = await env.DB.prepare(`SELECT notices.*, products.name AS product_name FROM notices LEFT JOIN products ON products.id = notices.product_id ${admin ? '' : 'WHERE notices.published = 1'} ORDER BY notices.created_at DESC LIMIT 100`).all();
    return json({ ok: true, notices: result.results.map((row) => ({ ...row, published: Boolean(row.published) })) });
  }
  await requireSession(request, env, 'admin');
  if (request.method === 'POST' && path.length === 1) {
    const data = await readJson(request);
    const type = ['news', 'restock', 'color', 'important'].includes(data.type) ? data.type : 'news';
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO notices (id, type, title, body, product_id, published, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, type, cleanText(data.title, 120, true), cleanText(data.body, 2000, true), cleanText(data.productId, 100) || null, data.published === false ? 0 : 1, now).run();
    return json({ ok: true, id }, 201);
  }
  if (request.method === 'PUT' && path.length === 2) {
    const data = await readJson(request);
    const type = ['news', 'restock', 'color', 'important'].includes(data.type) ? data.type : 'news';
    const result = await env.DB.prepare('UPDATE notices SET type = ?, title = ?, body = ?, product_id = ?, published = ? WHERE id = ?')
      .bind(type, cleanText(data.title, 120, true), cleanText(data.body, 2000, true), cleanText(data.productId, 100) || null, data.published === false ? 0 : 1, path[1]).run();
    if (!result.meta.changes) return fail('お知らせが見つかりません。', 404, 'NOT_FOUND');
    return json({ ok: true });
  }
  if (request.method === 'DELETE' && path.length === 2) {
    await env.DB.prepare('DELETE FROM notices WHERE id = ?').bind(path[1]).run();
    return json({ ok: true });
  }
  return fail('見つかりません。', 404, 'NOT_FOUND');
}

async function handleContacts(context, path) {
  const { request, env } = context;
  if (request.method === 'POST' && path.length === 1) {
    const data = await readJson(request);
    const user = await getSession(request, env, 'user');
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO contacts (id, user_id, name, email, type, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user?.user_id || null, cleanText(data.name, 80, true), cleanEmail(data.email), cleanText(data.type, 100, true), cleanText(data.message, 3000, true), 'unread', now, now).run();
    return json({ ok: true, id }, 201);
  }
  await requireSession(request, env, 'admin');
  if (request.method === 'GET' && path.length === 1) {
    const result = await env.DB.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 500').all();
    return json({ ok: true, contacts: result.results });
  }
  if (request.method === 'PATCH' && path.length === 2) {
    const data = await readJson(request);
    const status = ['unread', 'working', 'done'].includes(data.status) ? data.status : null;
    if (!status) return fail('対応状況が不正です。');
    await env.DB.prepare('UPDATE contacts SET status = ?, updated_at = ? WHERE id = ?').bind(status, new Date().toISOString(), path[1]).run();
    return json({ ok: true });
  }
  return fail('見つかりません。', 404, 'NOT_FOUND');
}

async function handleRestock(context, path) {
  const { request, env } = context;
  const user = await requireSession(request, env, 'user');
  if (request.method === 'GET' && path.length === 1) {
    const result = await env.DB.prepare(`SELECT restock_requests.*, products.name AS product_name, products.images, products.status
      FROM restock_requests JOIN products ON products.id = restock_requests.product_id WHERE restock_requests.user_id = ? ORDER BY restock_requests.created_at DESC`).bind(user.user_id).all();
    return json({ ok: true, requests: result.results.map((row) => ({ ...row, images: JSON.parse(row.images || '[]') })) });
  }
  if (request.method === 'POST' && path.length === 1) {
    const data = await readJson(request);
    const productId = cleanText(data.productId, 100, true);
    const product = await env.DB.prepare('SELECT id FROM products WHERE id = ? AND published = 1').bind(productId).first();
    if (!product) return fail('商品が見つかりません。', 404, 'NOT_FOUND');
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare('INSERT INTO restock_requests (id, user_id, product_id, color, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, user.user_id, productId, cleanText(data.color, 100), new Date().toISOString()).run();
    } catch (error) {
      if (String(error).includes('UNIQUE')) return fail('すでに再販待ちへ登録済みです。', 409, 'ALREADY_EXISTS');
      throw error;
    }
    return json({ ok: true, id }, 201);
  }
  if (request.method === 'DELETE' && path.length === 2) {
    await env.DB.prepare('DELETE FROM restock_requests WHERE id = ? AND user_id = ?').bind(path[1], user.user_id).run();
    return json({ ok: true });
  }
  return fail('見つかりません。', 404, 'NOT_FOUND');
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (!env.DB || !env.PRODUCT_IMAGES) return fail('保存先が設定されていません。', 503, 'NOT_CONFIGURED');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !isSameOrigin(request)) return fail('不正な送信元です。', 403, 'FORBIDDEN');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    const rawPath = context.params.path;
    const path = (Array.isArray(rawPath) ? rawPath : [rawPath]).filter(Boolean).map(String);
    if (!path.length) return fail('見つかりません。', 404, 'NOT_FOUND');
    if (path[0] === 'images') return await handleImages(context, path);
    if (path[0] === 'auth') return await handleAuth(context, path);
    if (path[0] === 'admin') return await handleAdmin(context, path);
    if (path[0] === 'products') return await handleProducts(context, path);
    if (path[0] === 'notices') return await handleNotices(context, path);
    if (path[0] === 'contacts') return await handleContacts(context, path);
    if (path[0] === 'restock') return await handleRestock(context, path);
    return fail('見つかりません。', 404, 'NOT_FOUND');
  } catch (error) {
    const status = Number(error.status) || 500;
    const code = error.code || (status === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
    console.error(JSON.stringify({ level: 'error', code, path: new URL(request.url).pathname, method: request.method, message: error.message }));
    return fail(status === 500 ? '処理に失敗しました。時間をおいて再度お試しください。' : error.message, status, code);
  }
}
