ALTER TABLE products ADD COLUMN variants TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0);

UPDATE products SET variants = '[{"name":"Pink","image":"/assets/item-01.webp"},{"name":"Blue","image":"/assets/item-03.webp"},{"name":"Clear","image":"/assets/item-06.webp"}]' WHERE id = 'color-mix';
UPDATE products SET variants = '[{"name":"Green","image":"/assets/item-02.webp"},{"name":"Orange","image":"/assets/item-09.webp"}]' WHERE id = 'forest-drop';
UPDATE products SET variants = '[{"name":"Pastel","image":"/assets/item-03.webp"},{"name":"Pink","image":"/assets/item-01.webp"},{"name":"Mix","image":"/assets/item-06.webp"}]' WHERE id = 'soft-aurora';
UPDATE products SET variants = '[{"name":"5 Colors","image":"/assets/item-04.webp"},{"name":"Clear","image":"/assets/item-08.webp"}]' WHERE id = 'tiny-drop';
UPDATE products SET variants = '[{"name":"Variation","image":"/assets/item-05.webp"},{"name":"Clear","image":"/assets/item-06.webp"}]' WHERE id = 'mini-hoop';
UPDATE products SET variants = '[{"name":"5 Colors","image":"/assets/item-07.webp"},{"name":"Green","image":"/assets/item-10.webp"}]' WHERE id = 'long-beads';
UPDATE products SET stock_quantity = CASE WHEN status = 'sold' THEN 0 ELSE 1 END;
