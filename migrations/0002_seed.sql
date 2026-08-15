INSERT OR IGNORE INTO products (id, name, price, category, colors, material, fitting, description, status, published, images, sales_url, sort_order, created_at, updated_at) VALUES
('color-mix', 'Color Mix', 0, 'ear', '["Pink","Blue","Clear"]', 'ガラスビーズ / 金具', 'ピアス（イヤリング変更可）', 'ピンク、ブルー、クリアの粒が重なる、可愛らしく透明感のあるデザイン。', 'new', 1, '["/assets/item-01.webp","/assets/item-03.webp","/assets/item-06.webp"]', '', 10, datetime('now'), datetime('now')),
('forest-drop', 'Forest Drop', 0, 'ear', '["Green","Orange"]', 'ガラスビーズ / 金具', 'ピアス（イヤリング変更可）', '深いグリーンと透明感を重ねた、落ち着いた色味のドロップデザイン。', 'low', 1, '["/assets/item-02.webp","/assets/item-09.webp"]', '', 20, datetime('now'), datetime('now')),
('soft-aurora', 'Soft Aurora', 0, 'ear', '["Pastel","Pink","Mix"]', 'ガラスビーズ / 金具', 'ピアス', '淡い色のビーズが光を受けて、やさしくきらめくデザイン。', 'new', 1, '["/assets/item-03.webp","/assets/item-01.webp","/assets/item-06.webp"]', '', 30, datetime('now'), datetime('now')),
('tiny-drop', 'Tiny Drop', 0, 'ear', '["5 Colors","Clear"]', 'ガラスビーズ / 雫パーツ', 'イヤリング（ピアス変更可）', '小さなビーズと雫モチーフを組み合わせた、日常使いしやすいデザイン。', 'sold', 1, '["/assets/item-04.webp","/assets/item-08.webp"]', '', 40, datetime('now'), datetime('now')),
('mini-hoop', 'Mini Hoop', 0, 'ear', '["Variation","Clear"]', 'ガラスビーズ / 金具', 'ピアス（イヤリング変更可）', 'ビーズを小さな輪に集めた、ころんとしたフォルム。', 'available', 1, '["/assets/item-05.webp","/assets/item-06.webp"]', '', 50, datetime('now'), datetime('now')),
('long-beads', 'Long Beads', 0, 'ear', '["5 Colors","Green"]', 'ガラスビーズ / 金具', 'ピアス（イヤリング変更可）', '縦のラインを活かした、揺れ感のあるロングタイプ。', 'low', 1, '["/assets/item-07.webp","/assets/item-10.webp"]', '', 60, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO notices (id, type, title, body, product_id, published, created_at) VALUES
('welcome-notice', 'news', 'Lux Canisへようこそ', '新作や再販のお知らせをこちらでご案内します。', NULL, 1, datetime('now'));
