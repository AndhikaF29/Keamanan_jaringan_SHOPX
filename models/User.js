const db = require('../config/database');
const bcrypt = require('bcrypt');
const { encrypt, decrypt, encryptFields, decryptFields, doubleEncrypt, doubleDecrypt } = require('../utils/encryption');

class User {
  /**
   * Registrasi pengguna baru
   * @param {Object} userData - Data pengguna (username, email, password, full_name, dll)
   * @returns {Promise<Object>} - Objek user yang baru dibuat (tanpa password)
   */
  static async register(userData) {
    try {
      // Enkripsi password menggunakan bcrypt
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Enkripsi data sensitif (alamat, nomor telepon)
      const sensitiveFields = ['address', 'phone_number'];
      // Data alamat memerlukan enkripsi ganda karena sangat sensitif
      const extraSensitiveFields = ['address'];
      const encryptedUserData = encryptFields(userData, sensitiveFields, extraSensitiveFields);
      
      // Periksa kolom proteksi ada di database
      let protectionColumnsExist = true;
      try {
        // Coba cek apakah kolom protection ada
        await db.query('SELECT address_protection FROM users LIMIT 1');
      } catch (error) {
        // Jika error, kemungkinan kolom belum ada
        protectionColumnsExist = false;
        console.log('Protection columns do not exist in users table');
      }
      
      let query;
      let params;
      
      if (protectionColumnsExist) {
        // Gunakan query dengan kolom protection
        query = `INSERT INTO users (username, email, password, full_name, address, address_protection,
                 phone_number, phone_number_protection, role) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user')`;
                 
        params = [
          userData.username,
          userData.email,
          hashedPassword,
          userData.full_name,
          encryptedUserData.address_encrypted || null,
          encryptedUserData.address_protection || null,
          encryptedUserData.phone_number_encrypted || null,
          encryptedUserData.phone_number_protection || null
        ];
      } else {
        // Gunakan query tanpa kolom protection
        query = `INSERT INTO users (username, email, password, full_name, address, phone_number) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
                 
        params = [
          userData.username,
          userData.email,
          hashedPassword,
          userData.full_name,
          encryptedUserData.address_encrypted || null,
          encryptedUserData.phone_number_encrypted || null
        ];
      }
      
      // Simpan user ke database
      const [result] = await db.query(query, params);
      
      // Ambil data user yang baru dibuat (tanpa password)
      const [user] = await db.query(
        'SELECT id, username, email, full_name FROM users WHERE id = ?',
        [result.insertId]
      );
      
      return user[0];
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }
  
  /**
   * Login pengguna
   * @param {string} email - Email pengguna
   * @param {string} password - Password pengguna
   * @returns {Promise<Object>} - Data pengguna (tanpa password) jika kredensial benar
   */
  static async login(email, password) {
    try {
      // Cari user berdasarkan email
      const [rows] = await db.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      
      if (rows.length === 0) {
        throw new Error('Email atau password salah');
      }
      
      const user = rows[0];
      
      // Verifikasi password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        throw new Error('Email atau password salah');
      }
      
      // Dekripsi data sensitif - dengan handle untuk kolom protection yang mungkin tidak ada
      const sensitiveFields = ['address', 'phone_number'];
      
      // Persiapkan data terenkripsi dengan toleransi terhadap kolom protection yang mungkin tidak ada
      const encryptedData = {
        address_encrypted: user.address,
        phone_number_encrypted: user.phone_number
      };
      
      // Tambahkan protection level jika ada
      if (user.address_protection !== undefined) {
        encryptedData.address_protection = user.address_protection;
      }
      
      if (user.phone_number_protection !== undefined) {
        encryptedData.phone_number_protection = user.phone_number_protection;
      }
      
      const userWithDecryptedData = decryptFields(encryptedData, sensitiveFields);
      
      // Hapus password dan protection field dari objek user sebelum mengembalikannya
      delete user.password;
      if (user.address_protection !== undefined) delete user.address_protection;
      if (user.phone_number_protection !== undefined) delete user.phone_number_protection;
      
      // Tambahkan data yang didekripsi
      user.address = userWithDecryptedData.address;
      user.phone_number = userWithDecryptedData.phone_number;
      
      return user;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }
  
  /**
   * Mendapatkan data pengguna berdasarkan ID
   * @param {number} id - ID pengguna
   * @returns {Promise<Object>} - Data pengguna dengan data sensitif terdekripsi
   */
  static async getById(id) {
    try {
      // Cek apakah kolom protection ada di database
      let protectionColumnsExist = true;
      try {
        await db.query('SELECT address_protection FROM users LIMIT 1');
      } catch (error) {
        protectionColumnsExist = false;
      }
      
      let query;
      if (protectionColumnsExist) {
        query = 'SELECT id, username, email, full_name, address, address_protection, phone_number, phone_number_protection, role FROM users WHERE id = ?';
      } else {
        query = 'SELECT id, username, email, full_name, address, phone_number, role FROM users WHERE id = ?';
      }
      
      const [rows] = await db.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const user = rows[0];
      
      // Dekripsi data sensitif
      const sensitiveFields = ['address', 'phone_number'];
      
      // Persiapkan data terenkripsi dengan toleransi terhadap kolom protection yang mungkin tidak ada
      const encryptedData = {
        address_encrypted: user.address,
        phone_number_encrypted: user.phone_number
      };
      
      // Tambahkan protection level jika ada
      if (user.address_protection !== undefined) {
        encryptedData.address_protection = user.address_protection;
      }
      
      if (user.phone_number_protection !== undefined) {
        encryptedData.phone_number_protection = user.phone_number_protection;
      }
      
      const userWithDecryptedData = decryptFields(encryptedData, sensitiveFields);
      
      // Tambahkan data yang didekripsi
      user.address = userWithDecryptedData.address;
      user.phone_number = userWithDecryptedData.phone_number;
      
      // Hapus field protection dari output
      if (user.address_protection !== undefined) delete user.address_protection;
      if (user.phone_number_protection !== undefined) delete user.phone_number_protection;
      
      return user;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }
  
  /**
   * Memperbarui data pengguna
   * @param {number} id - ID pengguna
   * @param {Object} userData - Data pengguna yang diperbarui
   * @returns {Promise<Object>} - Data pengguna yang diperbarui
   */
  static async update(id, userData) {
    try {
      // Cek apakah kolom protection ada di database
      let protectionColumnsExist = true;
      try {
        await db.query('SELECT address_protection FROM users LIMIT 1');
      } catch (error) {
        protectionColumnsExist = false;
      }
      
      // Enkripsi data sensitif
      const sensitiveFields = ['address', 'phone_number'];
      // Data alamat memerlukan enkripsi ganda karena sangat sensitif
      const extraSensitiveFields = ['address'];
      const encryptedUserData = encryptFields(userData, sensitiveFields, extraSensitiveFields);
      
      let query;
      let params;
      
      if (protectionColumnsExist) {
        // Gunakan query dengan kolom protection
        query = `UPDATE users SET
                 full_name = ?,
                 address = ?,
                 address_protection = ?,
                 phone_number = ?,
                 phone_number_protection = ?,
                 updated_at = NOW()
                 WHERE id = ?`;
        
        params = [
          userData.full_name,
          encryptedUserData.address_encrypted || null,
          encryptedUserData.address_protection || null,
          encryptedUserData.phone_number_encrypted || null,
          encryptedUserData.phone_number_protection || null,
          id
        ];
      } else {
        // Gunakan query tanpa kolom protection
        query = `UPDATE users SET
                 full_name = ?,
                 address = ?,
                 phone_number = ?,
                 updated_at = NOW()
                 WHERE id = ?`;
        
        params = [
          userData.full_name,
          encryptedUserData.address_encrypted || null,
          encryptedUserData.phone_number_encrypted || null,
          id
        ];
      }
      
      // Memperbarui data pengguna di database
      await db.query(query, params);
      
      // Ambil data pengguna yang diperbarui
      return await this.getById(id);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }
}

module.exports = User; 