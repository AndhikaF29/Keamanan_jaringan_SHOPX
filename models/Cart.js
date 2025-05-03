const db = require('../config/database');

class Cart {
  /**
   * Mendapatkan item di keranjang pengguna
   * @param {number} userId - ID pengguna
   * @returns {Promise<Array>} - Array item di keranjang dengan detail produk
   */
  static async getByUserId(userId) {
    try {
      const [rows] = await db.query(
        `SELECT c.id, c.user_id, c.product_id, c.quantity, 
                p.name, p.price, p.image_url, p.stock
         FROM cart c
         JOIN products p ON c.product_id = p.id
         WHERE c.user_id = ?`,
        [userId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error getting cart items:', error);
      throw error;
    }
  }
  
  /**
   * Menambahkan item ke keranjang
   * @param {Object} cartData - Data item keranjang (user_id, product_id, quantity)
   * @returns {Promise<Object>} - Item yang ditambahkan
   */
  static async addItem(cartData) {
    try {
      // Cek apakah item sudah ada di keranjang
      const [existingItems] = await db.query(
        'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
        [cartData.user_id, cartData.product_id]
      );
      
      if (existingItems.length > 0) {
        // Update kuantitas jika item sudah ada
        const newQuantity = existingItems[0].quantity + cartData.quantity;
        await db.query(
          'UPDATE cart SET quantity = ?, updated_at = NOW() WHERE id = ?',
          [newQuantity, existingItems[0].id]
        );
        
        return { id: existingItems[0].id, quantity: newQuantity };
      } else {
        // Tambahkan item baru ke keranjang
        const [result] = await db.query(
          'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
          [cartData.user_id, cartData.product_id, cartData.quantity]
        );
        
        return { id: result.insertId, ...cartData };
      }
    } catch (error) {
      console.error('Error adding item to cart:', error);
      throw error;
    }
  }
  
  /**
   * Mengupdate kuantitas item di keranjang
   * @param {number} cartId - ID item keranjang
   * @param {number} userId - ID pengguna (untuk verifikasi)
   * @param {number} quantity - Kuantitas baru
   * @returns {Promise<Object>} - Status keberhasilan
   */
  static async updateQuantity(cartId, userId, quantity) {
    try {
      // Verifikasi kepemilikan keranjang
      const [cart] = await db.query(
        'SELECT * FROM cart WHERE id = ? AND user_id = ?',
        [cartId, userId]
      );
      
      if (cart.length === 0) {
        throw new Error('Item tidak ditemukan di keranjang');
      }
      
      // Update kuantitas
      await db.query(
        'UPDATE cart SET quantity = ?, updated_at = NOW() WHERE id = ?',
        [quantity, cartId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }
  
  /**
   * Menghapus item dari keranjang
   * @param {number} cartId - ID item keranjang
   * @param {number} userId - ID pengguna (untuk verifikasi)
   * @returns {Promise<Object>} - Status keberhasilan
   */
  static async removeItem(cartId, userId) {
    try {
      // Verifikasi kepemilikan keranjang
      const [cart] = await db.query(
        'SELECT * FROM cart WHERE id = ? AND user_id = ?',
        [cartId, userId]
      );
      
      if (cart.length === 0) {
        throw new Error('Item tidak ditemukan di keranjang');
      }
      
      // Hapus item
      await db.query('DELETE FROM cart WHERE id = ?', [cartId]);
      
      return { success: true };
    } catch (error) {
      console.error('Error removing item from cart:', error);
      throw error;
    }
  }
  
  /**
   * Mengosongkan keranjang pengguna
   * @param {number} userId - ID pengguna
   * @returns {Promise<Object>} - Status keberhasilan
   */
  static async clearCart(userId) {
    try {
      await db.query('DELETE FROM cart WHERE user_id = ?', [userId]);
      
      return { success: true };
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }
  
  /**
   * Menghitung total keranjang
   * @param {number} userId - ID pengguna
   * @returns {Promise<Object>} - Total harga dan jumlah item
   */
  static async getCartTotal(userId) {
    try {
      const [result] = await db.query(
        `SELECT SUM(c.quantity * p.price) as total_price, 
                SUM(c.quantity) as total_items
         FROM cart c
         JOIN products p ON c.product_id = p.id
         WHERE c.user_id = ?`,
        [userId]
      );
      
      return {
        total_price: result[0].total_price || 0,
        total_items: result[0].total_items || 0
      };
    } catch (error) {
      console.error('Error calculating cart total:', error);
      throw error;
    }
  }
}

module.exports = Cart; 