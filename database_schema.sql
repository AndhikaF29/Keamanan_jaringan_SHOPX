-- Membuat database
CREATE DATABASE IF NOT EXISTS shopx_db;
USE shopx_db;

-- Tabel users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  address TEXT,               -- Disimpan terenkripsi
  address_protection ENUM('standard', 'double') DEFAULT 'standard', -- Level proteksi enkripsi
  phone_number VARCHAR(255),  -- Disimpan terenkripsi
  phone_number_protection ENUM('standard', 'double') DEFAULT 'standard', -- Level proteksi enkripsi
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel payment_info (untuk data kartu kredit terenkripsi)
CREATE TABLE IF NOT EXISTS payment_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  card_number_encrypted TEXT NOT NULL,
  card_number_protection ENUM('standard', 'double') DEFAULT 'double', -- Level proteksi enkripsi
  card_holder_encrypted TEXT NOT NULL,
  card_holder_protection ENUM('standard', 'double') DEFAULT 'standard', -- Level proteksi enkripsi
  expiry_date_encrypted TEXT NOT NULL,
  expiry_date_protection ENUM('standard', 'double') DEFAULT 'standard', -- Level proteksi enkripsi
  cvv_encrypted TEXT NOT NULL,
  cvv_protection ENUM('standard', 'double') DEFAULT 'double', -- Level proteksi enkripsi
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabel products
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(255),
  stock INT NOT NULL DEFAULT 0,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel orders
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  shipping_address_encrypted TEXT NOT NULL,  -- Disimpan terenkripsi
  shipping_address_protection ENUM('standard', 'double') DEFAULT 'double', -- Level proteksi enkripsi
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabel order_items
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Tabel cart
CREATE TABLE IF NOT EXISTS cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_product (user_id, product_id)
);

-- Tambahkan admin default (username: admin, password: admin123)
-- Password akan di-hash saat registrasi di aplikasi
INSERT INTO users (username, email, password, full_name, role)
VALUES (
  'admin', 
  'admin@shopx.com', 
  '$2b$10$6wVK0hRCVqf1oFfDhGSeLO9MlSAvCM8UzRw2.H83qx2FGqZ4KPPLm', -- Hashed 'admin123'
  'Admin ShopX', 
  'admin'
);

-- Tambahkan beberapa produk contoh
INSERT INTO products (name, description, price, image_url, stock, category) VALUES
('Smartphone XYZ', 'Smartphone canggih dengan kamera 108MP dan layar AMOLED', 8999000, 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500', 50, 'smartphone'),
('Laptop UltraBook', 'Laptop tipis dan ringan dengan performa tinggi dan baterai tahan lama', 12500000, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500', 30, 'laptop'),
('Wireless Earbuds', 'Earbuds wireless dengan kualitas suara premium dan noise cancelling', 1499000, 'https://images.unsplash.com/photo-1605464315542-bda3e2f4e605?w=500', 100, 'accessories'),
('Smartwatch Pro', 'Smartwatch dengan fitur kesehatan lengkap dan baterai tahan hingga 7 hari', 2999000, 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500', 45, 'accessories'),
('DSLR Camera', 'Kamera DSLR profesional dengan sensor full-frame', 15999000, 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=500', 20, 'camera'),
('External SSD 1TB', 'SSD eksternal dengan kecepatan transfer tinggi dan durable', 1899000, 'https://images.unsplash.com/photo-1597248881519-db089d3744a5?w=500', 60, 'accessories');

-- Catatan: Data sensitif seperti alamat, nomor telepon, dan informasi kartu kredit 
-- akan dienkripsi menggunakan AES-256 sebelum disimpan di database melalui aplikasi.
-- Data yang sangat sensitif seperti kartu kredit, CVV, dan alamat pengiriman akan
-- dienkripsi ganda menggunakan kombinasi AES-256, PBKDF2 key derivation, dan HMAC
-- untuk verifikasi integritas data. 