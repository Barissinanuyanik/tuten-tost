DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  pin TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS expenses;
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_name TEXT DEFAULT 'Genel Masraf',
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1.00,
  amount REAL NOT NULL,
  is_paid INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS global_chat_logs;
CREATE TABLE global_chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  chat_data TEXT DEFAULT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  order_note TEXT DEFAULT NULL,
  total_price REAL NOT NULL,
  earned_points INTEGER DEFAULT 0,
  used_points INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'Nakit',
  status TEXT DEFAULT 'Hazırlanıyor',
  cancel_reason TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_paid INTEGER DEFAULT 0,
  chat_log TEXT DEFAULT NULL
);
