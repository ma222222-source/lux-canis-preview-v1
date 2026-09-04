PRAGMA defer_foreign_keys = true;

CREATE TABLE products_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  category TEXT NOT NULL DEFAULT 'ear' CHECK (category IN ('ear', 'bracelet', 'necklace', 'charm', 'other')),
  colors TEXT NOT NULL DEFAULT '[]',
  material TEXT NOT NULL DEFAULT '',
  fitting TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('new', 'low', 'sold', 'available')),
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
  images TEXT NOT NULL DEFAULT '[]',
  sales_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  variants TEXT NOT NULL DEFAULT '[]',
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)
);

INSERT INTO products_new (id, name, price, category, colors, material, fitting, description, status, published, images, sales_url, sort_order, created_at, updated_at, variants, stock_quantity)
SELECT id, name, price, category, colors, material, fitting, description, status, published, images, sales_url, sort_order, created_at, updated_at, variants, stock_quantity FROM products;

CREATE TABLE notices_backup AS SELECT * FROM notices;
CREATE TABLE restock_requests_backup AS SELECT * FROM restock_requests;

DROP TABLE notices;
DROP TABLE restock_requests;
DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

CREATE TABLE notices (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'news' CHECK (type IN ('news', 'restock', 'color', 'important')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  product_id TEXT,
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

INSERT INTO notices (id, type, title, body, product_id, published, created_at)
SELECT id, type, title, body, product_id, published, created_at FROM notices_backup;

CREATE TABLE restock_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (user_id, product_id, color),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

INSERT INTO restock_requests (id, user_id, product_id, color, created_at)
SELECT id, user_id, product_id, color, created_at FROM restock_requests_backup;

DROP TABLE notices_backup;
DROP TABLE restock_requests_backup;

CREATE INDEX idx_products_public ON products(published, sort_order);
CREATE INDEX idx_notices_public ON notices(published, created_at);
CREATE INDEX idx_restock_product ON restock_requests(product_id, created_at);

PRAGMA defer_foreign_keys = false;
