const db = require('../config/database');

class Product {
  /**
   * Mendapatkan semua produk
   * @param {Object} options - Opsi filter dan pagination
   * @returns {Promise<Array>} - Array produk
   */
  static async getAll(options = {}) {
    try {
      const { category, search, limit = 10, page = 1 } = options;
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT * FROM products
        WHERE 1=1
      `;
      
      const params = [];
      
      // Filter berdasarkan kategori
      if (category) {
        query += ` AND category = ?`;
        params.push(category);
      }
      
      // Filter berdasarkan pencarian
      if (search) {
        query += ` AND (name LIKE ? OR description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }
      
      // Tambahkan ordering dan limit
      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));
      
      const [rows] = await db.query(query, params);
      
      return rows;
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }
  
  /**
   * Mendapatkan produk berdasarkan ID
   * @param {number} id - ID produk
   * @returns {Promise<Object>} - Detail produk
   */
  static async getById(id) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0];
    } catch (error) {
      console.error('Error getting product by ID:', error);
      throw error;
    }
  }
  
  /**
   * Mendapatkan produk berdasarkan kategori
   * @param {string} category - Kategori produk
   * @returns {Promise<Array>} - Array produk dalam kategori
   */
  static async getByCategory(category) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM products WHERE category = ? ORDER BY created_at DESC',
        [category]
      );
      
      return rows;
    } catch (error) {
      console.error('Error getting products by category:', error);
      throw error;
    }
  }
  
  /**
   * Mencari produk berdasarkan kata kunci
   * @param {string} keyword - Kata kunci pencarian
   * @returns {Promise<Array>} - Array produk hasil pencarian
   */
  static async search(keyword) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM products 
         WHERE name LIKE ? OR description LIKE ? 
         ORDER BY created_at DESC`,
        [`%${keyword}%`, `%${keyword}%`]
      );
      
      return rows;
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }
  
  /**
   * Menambahkan produk baru
   * @param {Object} productData - Data produk baru
   * @returns {Promise<Object>} - Produk yang baru ditambahkan
   */
  static async create(productData) {
    try {
      const [result] = await db.query(
        `INSERT INTO products (name, description, price, image_url, stock, category) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          productData.name,
          productData.description,
          productData.price,
          productData.image_url,
          productData.stock,
          productData.category
        ]
      );
      
      return await this.getById(result.insertId);
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }
  
  /**
   * Memperbarui produk yang ada
   * @param {number} id - ID produk
   * @param {Object} productData - Data produk yang diperbarui
   * @returns {Promise<Object>} - Produk yang diperbarui
   */
  static async update(id, productData) {
    try {
      await db.query(
        `UPDATE products SET
         name = ?,
         description = ?,
         price = ?,
         image_url = ?,
         stock = ?,
         category = ?,
         updated_at = NOW()
         WHERE id = ?`,
        [
          productData.name,
          productData.description,
          productData.price,
          productData.image_url,
          productData.stock,
          productData.category,
          id
        ]
      );
      
      return await this.getById(id);
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }
  
  /**
   * Menghapus produk
   * @param {number} id - ID produk
   * @returns {Promise<Object>} - Status keberhasilan
   */
  static async delete(id) {
    try {
      await db.query('DELETE FROM products WHERE id = ?', [id]);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }
}

module.exports = Product; 