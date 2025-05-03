const db = require('../config/database');
const { encrypt, decrypt, encryptFields, decryptFields, doubleEncrypt, doubleDecrypt } = require('../utils/encryption');

class PaymentInfo {
  /**
   * Menyimpan informasi pembayaran baru
   * @param {Object} paymentData - Data pembayaran (user_id, card_number, card_holder, expiry_date, cvv)
   * @returns {Promise<Object>} - ID dari informasi pembayaran yang disimpan
   */
  static async save(paymentData) {
    try {
      // Enkripsi data sensitif pembayaran
      const sensitiveFields = ['card_number', 'card_holder', 'expiry_date', 'cvv'];
      // Data kartu kredit dan CVV memerlukan enkripsi ganda karena sangat sensitif
      const extraSensitiveFields = ['card_number', 'cvv'];
      const encryptedPaymentData = encryptFields(paymentData, sensitiveFields, extraSensitiveFields);
      
      // Periksa kolom proteksi ada di database
      let protectionColumnsExist = true;
      try {
        // Coba cek apakah kolom protection ada
        await db.query('SELECT card_number_protection FROM payment_info LIMIT 1');
      } catch (error) {
        // Jika error, kemungkinan kolom belum ada
        protectionColumnsExist = false;
        console.log('Protection columns do not exist in payment_info table');
      }
      
      let query;
      let params;
      
      if (protectionColumnsExist) {
        // Gunakan query dengan kolom protection
        query = `INSERT INTO payment_info (
          user_id, 
          card_number_encrypted,
          card_number_protection, 
          card_holder_encrypted,
          card_holder_protection,
          expiry_date_encrypted,
          expiry_date_protection,
          cvv_encrypted,
          cvv_protection
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        params = [
          paymentData.user_id,
          encryptedPaymentData.card_number_encrypted,
          encryptedPaymentData.card_number_protection,
          encryptedPaymentData.card_holder_encrypted,
          encryptedPaymentData.card_holder_protection,
          encryptedPaymentData.expiry_date_encrypted,
          encryptedPaymentData.expiry_date_protection,
          encryptedPaymentData.cvv_encrypted,
          encryptedPaymentData.cvv_protection
        ];
      } else {
        // Gunakan query tanpa kolom protection
        query = `INSERT INTO payment_info (
          user_id, 
          card_number_encrypted,
          card_holder_encrypted,
          expiry_date_encrypted,
          cvv_encrypted
        ) VALUES (?, ?, ?, ?, ?)`;
        
        params = [
          paymentData.user_id,
          encryptedPaymentData.card_number_encrypted,
          encryptedPaymentData.card_holder_encrypted,
          encryptedPaymentData.expiry_date_encrypted,
          encryptedPaymentData.cvv_encrypted
        ];
      }
      
      // Simpan data terenkripsi ke database
      const [result] = await db.query(query, params);
      
      return { id: result.insertId };
    } catch (error) {
      console.error('Error saving payment info:', error);
      throw error;
    }
  }
  
  /**
   * Mendapatkan informasi pembayaran berdasarkan user ID
   * @param {number} userId - ID pengguna
   * @returns {Promise<Object>} - Informasi pembayaran yang didekripsi
   */
  static async getByUserId(userId) {
    try {
      // Periksa kolom proteksi ada di database
      let protectionColumnsExist = true;
      try {
        // Coba cek apakah kolom protection ada
        await db.query('SELECT card_number_protection FROM payment_info LIMIT 1');
      } catch (error) {
        // Jika error, kemungkinan kolom belum ada
        protectionColumnsExist = false;
        console.log('Protection columns do not exist in payment_info table');
      }
      
      const [rows] = await db.query(
        `SELECT * FROM payment_info WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      const paymentInfo = rows[0];
      
      // Dekripsi data kartu kredit
      const sensitiveFields = ['card_number', 'card_holder', 'expiry_date', 'cvv'];
      
      // Persiapkan data terenkripsi dengan toleransi terhadap kolom protection yang mungkin tidak ada
      const encryptedData = {
        card_number_encrypted: paymentInfo.card_number_encrypted,
        card_holder_encrypted: paymentInfo.card_holder_encrypted,
        expiry_date_encrypted: paymentInfo.expiry_date_encrypted,
        cvv_encrypted: paymentInfo.cvv_encrypted
      };
      
      // Tambahkan protection level jika ada
      if (protectionColumnsExist) {
        encryptedData.card_number_protection = paymentInfo.card_number_protection;
        encryptedData.card_holder_protection = paymentInfo.card_holder_protection;
        encryptedData.expiry_date_protection = paymentInfo.expiry_date_protection;
        encryptedData.cvv_protection = paymentInfo.cvv_protection;
      }
      
      const decryptedPaymentInfo = decryptFields(encryptedData, sensitiveFields);
      
      // Kembalikan dengan ID dan user_id, tambahkan data yang didekripsi
      const result = {
        id: paymentInfo.id,
        user_id: paymentInfo.user_id,
        card_number: decryptedPaymentInfo.card_number,
        card_holder: decryptedPaymentInfo.card_holder,
        expiry_date: decryptedPaymentInfo.expiry_date,
        // CVV hanya didekripsi saat benar-benar dibutuhkan, tidak dikembalikan ke klien
        created_at: paymentInfo.created_at,
        updated_at: paymentInfo.updated_at
      };
      
      // Tambahkan informasi level keamanan jika kolom protection ada
      if (protectionColumnsExist) {
        result.security_level = {
          card_number: paymentInfo.card_number_protection === 'double' ? 'Tinggi (Double)' : 'Standard',
          cvv: paymentInfo.cvv_protection === 'double' ? 'Tinggi (Double)' : 'Standard'
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error getting payment info:', error);
      throw error;
    }
  }
  
  /**
   * Memperbarui informasi pembayaran
   * @param {number} id - ID informasi pembayaran
   * @param {Object} paymentData - Data pembayaran yang diperbarui
   * @returns {Promise<Object>} - Status keberhasilan
   */
  static async update(id, paymentData) {
    try {
      // Enkripsi data sensitif pembayaran
      const sensitiveFields = ['card_number', 'card_holder', 'expiry_date', 'cvv'];
      // Data kartu kredit dan CVV memerlukan enkripsi ganda karena sangat sensitif
      const extraSensitiveFields = ['card_number', 'cvv'];
      const encryptedPaymentData = encryptFields(paymentData, sensitiveFields, extraSensitiveFields);
      
      // Periksa kolom proteksi ada di database
      let protectionColumnsExist = true;
      try {
        // Coba cek apakah kolom protection ada
        await db.query('SELECT card_number_protection FROM payment_info LIMIT 1');
      } catch (error) {
        // Jika error, kemungkinan kolom belum ada
        protectionColumnsExist = false;
        console.log('Protection columns do not exist in payment_info table');
      }
      
      let query;
      let params;
      
      if (protectionColumnsExist) {
        // Gunakan query dengan kolom protection
        query = `UPDATE payment_info SET
                 card_number_encrypted = ?,
                 card_number_protection = ?,
                 card_holder_encrypted = ?,
                 card_holder_protection = ?,
                 expiry_date_encrypted = ?,
                 expiry_date_protection = ?,
                 cvv_encrypted = ?,
                 cvv_protection = ?,
                 updated_at = NOW()
                 WHERE id = ? AND user_id = ?`;
        
        params = [
          encryptedPaymentData.card_number_encrypted,
          encryptedPaymentData.card_number_protection,
          encryptedPaymentData.card_holder_encrypted,
          encryptedPaymentData.card_holder_protection,
          encryptedPaymentData.expiry_date_encrypted,
          encryptedPaymentData.expiry_date_protection,
          encryptedPaymentData.cvv_encrypted,
          encryptedPaymentData.cvv_protection,
          id,
          paymentData.user_id
        ];
      } else {
        // Gunakan query tanpa kolom protection
        query = `UPDATE payment_info SET
                 card_number_encrypted = ?,
                 card_holder_encrypted = ?,
                 expiry_date_encrypted = ?,
                 cvv_encrypted = ?,
                 updated_at = NOW()
                 WHERE id = ? AND user_id = ?`;
        
        params = [
          encryptedPaymentData.card_number_encrypted,
          encryptedPaymentData.card_holder_encrypted,
          encryptedPaymentData.expiry_date_encrypted,
          encryptedPaymentData.cvv_encrypted,
          id,
          paymentData.user_id
        ];
      }
      
      // Perbarui data terenkripsi di database
      await db.query(query, params);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating payment info:', error);
      throw error;
    }
  }
  
  /**
   * Menghapus informasi pembayaran
   * @param {number} id - ID informasi pembayaran
   * @param {number} userId - ID pengguna (untuk verifikasi)
   * @returns {Promise<Object>} - Status keberhasilan
   */
  static async delete(id, userId) {
    try {
      await db.query(
        'DELETE FROM payment_info WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting payment info:', error);
      throw error;
    }
  }
  
  /**
   * Verifikasi apakah pengguna tertentu memiliki informasi pembayaran
   * @param {number} userId - ID pengguna
   * @param {number} paymentInfoId - ID informasi pembayaran
   * @returns {Promise<boolean>} - true jika pengguna memiliki informasi pembayaran tersebut
   */
  static async verifyOwnership(userId, paymentInfoId) {
    try {
      const [rows] = await db.query(
        'SELECT id FROM payment_info WHERE id = ? AND user_id = ?',
        [paymentInfoId, userId]
      );
      
      return rows.length > 0;
    } catch (error) {
      console.error('Error verifying payment info ownership:', error);
      throw error;
    }
  }
}

module.exports = PaymentInfo; 