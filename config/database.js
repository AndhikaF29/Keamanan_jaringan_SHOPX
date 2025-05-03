const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool koneksi database
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Fungsi untuk menginisialisasi database (membuat tabel jika belum ada)
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Membuat tabel users
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        address TEXT,
        address_protection ENUM('standard', 'double') DEFAULT 'standard',
        phone_number VARCHAR(255),
        phone_number_protection ENUM('standard', 'double') DEFAULT 'standard',
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Membuat tabel payment_info (untuk data kartu kredit terenkripsi)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payment_info (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        card_number_encrypted TEXT NOT NULL,
        card_number_protection ENUM('standard', 'double') DEFAULT 'double',
        card_holder_encrypted TEXT NOT NULL,
        card_holder_protection ENUM('standard', 'double') DEFAULT 'standard',
        expiry_date_encrypted TEXT NOT NULL,
        expiry_date_protection ENUM('standard', 'double') DEFAULT 'standard',
        cvv_encrypted TEXT NOT NULL,
        cvv_protection ENUM('standard', 'double') DEFAULT 'double',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Membuat tabel products
    await connection.query(`
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
      )
    `);

    // Membuat tabel orders
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        shipping_address_encrypted TEXT NOT NULL,
        shipping_address_protection ENUM('standard', 'double') DEFAULT 'double',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Membuat tabel order_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Membuat tabel cart
    await connection.query(`
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
      )
    `);
    
    // Cek apakah perlu menambahkan admin default
    const [adminCheck] = await connection.query('SELECT * FROM users WHERE username = ?', ['admin']);
    
    if (adminCheck.length === 0) {
      // Tambahkan admin default jika belum ada
      await connection.query(`
        INSERT INTO users (username, email, password, full_name, role)
        VALUES (
          'admin', 
          'admin@shopx.com', 
          '$2b$10$6wVK0hRCVqf1oFfDhGSeLO9MlSAvCM8UzRw2.H83qx2FGqZ4KPPLm', 
          'Admin ShopX', 
          'admin'
        )
      `);
      console.log('Default admin user created');
    }
    
    connection.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Inisialisasi database saat modul ini diimpor
initDatabase();

module.exports = {
  pool,
  query: (...args) => pool.query(...args)
}; 