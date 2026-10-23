CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL,
    img TEXT DEFAULT 'img/kasarlitam.webp',
    stock INTEGER NOT NULL DEFAULT 100,
    bread_type TEXT DEFAULT 'Standart'
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT DEFAULT 'musteri@tutentost.com',
    address TEXT NOT NULL,
    order_note TEXT DEFAULT '',
    total_price REAL NOT NULL,
    payment_method TEXT DEFAULT 'Nakit',
    status TEXT DEFAULT 'Hazırlanıyor',
    cancel_reason TEXT DEFAULT NULL,
    is_paid INTEGER DEFAULT 0,
    chat_log TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    options TEXT DEFAULT 'Standart',
    drink TEXT DEFAULT 'Yok',
    price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_name TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    amount REAL NOT NULL,
    is_paid INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT 'İsimsiz Müşteri',
    pin TEXT DEFAULT '0000',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS global_chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    chat_data TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    customer_name TEXT DEFAULT 'Müşteri',
    message TEXT NOT NULL,
    direction TEXT DEFAULT 'inbound',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, description, price, img, stock, bread_type)
SELECT 'Karışık Tost (Büyük Boy)', '%100 Dana Sucuk ve Taze Kaşar', 120, 'img/karisiktam.webp', 100, '14x14 cm'
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

INSERT INTO products (name, description, price, img, stock, bread_type)
SELECT 'Karışık Tost (Orta Boy)', '%100 Dana Sucuk ve Taze Kaşar', 90, 'img/karisikyarim.webp', 100, '11x11 cm'
WHERE (SELECT COUNT(*) FROM products) = 1;

INSERT INTO products (name, description, price, img, stock, bread_type)
SELECT 'Kaşarlı Tost (Büyük Boy)', 'Bol Aknaz Kaşar Peynirli Sıcak Tost', 100, 'img/kasarlitam.webp', 100, '14x14 cm'
WHERE (SELECT COUNT(*) FROM products) = 2;