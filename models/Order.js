const db = require('../config/database');
const { encrypt, decrypt, encryptFields, decryptFields, doubleEncrypt, doubleDecrypt } = require('../utils/encryption');

class Order {
  /**
   * Membuat pesanan baru
   * @param {Object} orderData - Data pesanan (user_id, shipping_address, total_amount)
   * @param {Array} orderItems - Array item pesanan (product_id, quantity, price)
   * @returns {Promise<Object>} - Pesanan yang dibuat
   */
  static async create(orderData, orderItems) {
    const connection = await db.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Enkripsi alamat pengiriman
      const sensitiveFields = ['shipping_address'];
      // Alamat pengiriman memerlukan enkripsi ganda karena sangat sensitif
      const extraSensitiveFields = ['shipping_address'];
      const encryptedOrderData = encryptFields(orderData, sensitiveFields, extraSensitiveFields);
      
      // Buat pesanan
      const [result] = await connection.query(
        `INSERT INTO orders (user_id, total_amount, shipping_address_encrypted, 
         shipping_address_protection, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [
          orderData.user_id,
          orderData.total_amount,
          encryptedOrderData.shipping_address_encrypted,
          encryptedOrderData.shipping_address_protection
        ]
      );
      
      const orderId = result.insertId;
      
      // Tambahkan item-item pesanan
      for (const item of orderItems) {
        await connection.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES (?, ?, ?, ?)`,
          [orderId, item.product_id, item.quantity, item.price]
        );
        
        // Update stok produk
        await connection.query(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [item.quantity, item.product_id]
        );
      }
      
      // Kosongkan keranjang pengguna
      await connection.query(
        'DELETE FROM cart WHERE user_id = ?',
        [orderData.user_id]
      );
      
      await connection.commit();
      
      // Ambil pesanan yang baru dibuat
      return await this.getById(orderId);
    } catch (error) {
      await connection.rollback();
      console.error('Error creating order:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Mendapatkan pesanan berdasarkan ID
   * @param {number} id - ID pesanan
   * @returns {Promise<Object>} - Detail pesanan dengan item-item
   */
  static async getById(id) {
    try {
      // Ambil data pesanan
      const [orders] = await db.query(
        'SELECT * FROM orders WHERE id = ?',
        [id]
      );
      
      if (orders.length === 0) {
        return null;
      }
      
      const order = orders[0];
      
      // Dekripsi alamat pengiriman
      const decryptedOrder = decryptFields(
        { 
          shipping_address_encrypted: order.shipping_address_encrypted,
          shipping_address_protection: order.shipping_address_protection
        },
        ['shipping_address']
      );
      
      order.shipping_address = decryptedOrder.shipping_address;
      delete order.shipping_address_encrypted;
      delete order.shipping_address_protection;
      
      // Ambil item-item pesanan
      const [items] = await db.query(
        `SELECT oi.*, p.name, p.image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [id]
      );
      
      return {
        ...order,
        items,
        security_level: {
          shipping_address: order.shipping_address_protection === 'double' ? 'Tinggi (Double)' : 'Standard'
        }
      };
    } catch (error) {
      console.error('Error getting order:', error);
      throw error;
    }
  }
  
  /**
   * Mendapatkan semua pesanan pengguna
   * @param {number} userId - ID pengguna
   * @returns {Promise<Array>} - Array pesanan pengguna
   */
  static async getByUserId(userId) {
    try {
      const [orders] = await db.query(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      
      // Dekripsi alamat pengiriman untuk setiap pesanan
      const decryptedOrders = orders.map(order => {
        const decryptedOrder = decryptFields(
          { 
            shipping_address_encrypted: order.shipping_address_encrypted,
            shipping_address_protection: order.shipping_address_protection
          },
          ['shipping_address']
        );
        
        order.shipping_address = decryptedOrder.shipping_address;
        delete order.shipping_address_encrypted;
        
        // Tambahkan informasi level keamanan
        order.security_level = {
          shipping_address: order.shipping_address_protection === 'double' ? 'Tinggi (Double)' : 'Standard'
        };
        
        delete order.shipping_address_protection;
        
        return order;
      });
      
      // Tambahkan item untuk setiap pesanan
      for (const order of decryptedOrders) {
        const [items] = await db.query(
          `SELECT oi.product_id, oi.quantity, oi.price, p.name, p.image_url
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`,
          [order.id]
        );
        
        order.items = items;
      }
      
      return decryptedOrders;
    } catch (error) {
      console.error('Error getting user orders:', error);
      throw error;
    }
  }
  
  /**
   * Memperbarui status pesanan
   * @param {number} id - ID pesanan
   * @param {string} status - Status baru pesanan
   * @returns {Promise<Object>} - Status keberhasilan
   */
  static async updateStatus(id, status) {
    try {
      await db.query(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, id]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
}

module.exports = Order; 