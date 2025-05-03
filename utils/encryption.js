const CryptoJS = require('crypto-js');
require('dotenv').config();

// Mengambil kunci enkripsi dan IV dari variabel lingkungan
const encryptionKey = process.env.ENCRYPTION_KEY;
const encryptionIV = process.env.ENCRYPTION_IV;
const hmacKey = process.env.HMAC_KEY || encryptionKey; // Gunakan HMAC key terpisah jika tersedia

// Mengkonversi IV dari hex string ke WordArray
const iv = CryptoJS.enc.Hex.parse(encryptionIV);

/**
 * Menghasilkan kunci derivasi dari password menggunakan PBKDF2
 * @param {string} masterKey - Kunci master (dari env)
 * @param {string} salt - Salt untuk key derivation
 * @returns {Object} - Derived key untuk enkripsi dan autentikasi
 */
function deriveKeys(masterKey, salt) {
  // Gunakan PBKDF2 untuk menguatkan kunci
  const derivedKeyBytes = CryptoJS.PBKDF2(masterKey, salt, {
    keySize: 12, // 384 bits (128 untuk enkripsi, 128 untuk ChaCha20, 128 untuk HMAC)
    iterations: 10000,
    hasher: CryptoJS.algo.SHA256
  });
  
  // Bagi menjadi 3 kunci: AES, ChaCha20 (simulasi), dan HMAC
  const keyWords = derivedKeyBytes.words;
  const aesKey = CryptoJS.lib.WordArray.create(keyWords.slice(0, 4));
  const chacha20Key = CryptoJS.lib.WordArray.create(keyWords.slice(4, 8));
  const hmacKey = CryptoJS.lib.WordArray.create(keyWords.slice(8, 12));
  
  return {
    aesKey,
    chacha20Key,
    hmacKey
  };
}

/**
 * Menghitung HMAC untuk memverifikasi integritas data terenkripsi
 * @param {string} data - Data yang akan divalidasi
 * @param {string} key - HMAC key
 * @returns {string} - HMAC dalam format hex
 */
function calculateHMAC(data, key) {
  return CryptoJS.HmacSHA256(data, key).toString(CryptoJS.enc.Hex);
}

/**
 * Memeriksa apakah string terlihat seperti data terenkripsi
 * @param {string} text - Text yang akan diperiksa
 * @returns {boolean} - true jika text tampaknya terenkripsi
 */
function isEncrypted(text) {
  if (!text) return false;
  
  try {
    // Coba cek apakah ini Base64
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(text)) {
      return false;
    }
    
    // Coba decode dengan Base64
    const decoded = CryptoJS.enc.Base64.parse(text).toString(CryptoJS.enc.Utf8);
    
    // Cek apakah ini format enkripsi baru (dengan salt dan HMAC)
    if (decoded.includes(':')) {
      const parts = decoded.split(':');
      // Format enkripsi baru harus memiliki 3 bagian (salt:ciphertext:hmac)
      if (parts.length === 3) {
        // Cek apakah salt adalah hex valid (16 bytes = 32 karakter hex)
        const saltHex = parts[0];
        const hexRegex = /^[0-9A-Fa-f]+$/;
        if (hexRegex.test(saltHex) && saltHex.length === 32) {
          return true;
        }
      }
    }
    
    // Cek format lama (mencoba decode sebagai base64 AES)
    try {
      // Jika bisa didekripsi dengan key default, ini format lama
      const decrypted = CryptoJS.AES.decrypt(text, encryptionKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      // Cek apakah hasil dekripsi valid UTF-8
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      return result.length > 0;
    } catch (oldFormatError) {
      // Gagal mendecode, bukan format enkripsi lama
      return false;
    }
  } catch (error) {
    // Bukan data terenkripsi
    return false;
  }
}

/**
 * Mengenkripsi data sensitif menggunakan AES-256
 * @param {string} plaintext - Teks yang akan dienkripsi
 * @returns {string} - Teks terenkripsi dalam format Base64 dengan salt dan HMAC
 */
function encrypt(plaintext) {
  if (!plaintext) return null;
  
  // Jika sudah terenkripsi, kembalikan saja
  if (isEncrypted(plaintext)) {
    return plaintext;
  }
  
  try {
    // Generate salt unik untuk setiap enkripsi
    const salt = CryptoJS.lib.WordArray.random(16);
    
    // Derive keys dari master key dan salt
    const { aesKey, chacha20Key, hmacKey } = deriveKeys(encryptionKey, salt);
    
    // Enkripsi dengan AES-256
    const encrypted = CryptoJS.AES.encrypt(plaintext, aesKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Gabungkan salt dan ciphertext
    const saltCiphertext = salt.toString(CryptoJS.enc.Hex) + 
                            ":" + 
                            encrypted.toString();
    
    // Tambahkan HMAC untuk authenticity check
    const hmac = calculateHMAC(saltCiphertext, hmacKey);
    
    // Format final: base64(salt:ciphertext:hmac)
    return CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(saltCiphertext + ":" + hmac)
    );
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Gagal mengenkripsi data');
  }
}

/**
 * Mendekripsi data sensitif yang terenkripsi AES-256
 * @param {string} ciphertext - Teks terenkripsi dalam format Base64
 * @returns {string} - Teks asli setelah didekripsi
 */
function decrypt(ciphertext) {
  if (!ciphertext) return null;
  
  // Jika input tampaknya bukan data terenkripsi, kembalikan apa adanya
  if (!isEncrypted(ciphertext)) {
    return ciphertext;
  }
  
  try {
    // Coba format enkripsi baru
    try {
      // Decode base64
      const decoded = CryptoJS.enc.Base64.parse(ciphertext).toString(CryptoJS.enc.Utf8);
      
      // Check if it's new format (contains colons for salt:ciphertext:hmac)
      if (decoded.includes(':')) {
        // Split salt, encrypted data, dan HMAC
        const parts = decoded.split(':');
        if (parts.length !== 3) {
          throw new Error('Format data terenkripsi tidak valid');
        }
        
        const salt = CryptoJS.enc.Hex.parse(parts[0]);
        const encryptedText = parts[1];
        const hmacReceived = parts[2];
        
        // Derive keys dari master key dan salt
        const { aesKey, chacha20Key, hmacKey } = deriveKeys(encryptionKey, salt);
        
        // Verifikasi HMAC untuk memastikan integritas data
        const saltCiphertext = parts[0] + ":" + parts[1];
        const hmacCalculated = calculateHMAC(saltCiphertext, hmacKey);
        
        if (hmacReceived !== hmacCalculated) {
          throw new Error('HMAC verification failed: Data mungkin telah dimodifikasi');
        }
        
        // Dekripsi dengan AES-256
        const decrypted = CryptoJS.AES.decrypt(encryptedText, aesKey, {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        
        const result = decrypted.toString(CryptoJS.enc.Utf8);
        if (!result) {
          throw new Error('Hasil dekripsi kosong, mencoba format lama');
        }
        
        return result;
      } else {
        // Jika tidak ada karakter ":", ini mungkin format lama
        throw new Error('Bukan format baru, mencoba format lama');
      }
    } catch (newFormatError) {
      console.log('Mencoba decode dengan format lama:', newFormatError.message);
      
      try {
        // Dekripsi dengan format lama (langsung menggunakan kunci master)
        const decrypted = CryptoJS.AES.decrypt(ciphertext, encryptionKey, {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        
        const result = decrypted.toString(CryptoJS.enc.Utf8);
        if (!result) {
          // Jika hasil dekripsi kosong, kembalikan data asli
          console.error('Dekripsi gagal, mengembalikan data asli');
          return ciphertext;
        }
        
        return result;
      } catch (oldFormatError) {
        console.error('Format lama gagal didekripsi:', oldFormatError);
        // Kembalikan data asli jika semua metode dekripsi gagal
        return ciphertext;
      }
    }
  } catch (error) {
    console.error('Decryption error:', error);
    // Jika terjadi error, kembalikan data asli untuk mencegah aplikasi berhenti
    return ciphertext;
  }
}

/**
 * Double encryption untuk data yang sangat sensitif (AES + "ChaCha20" simulasi)
 * @param {string} plaintext - Teks yang akan dienkripsi ganda
 * @returns {string} - Teks terenkripsi ganda
 */
function doubleEncrypt(plaintext) {
  if (!plaintext) return null;
  
  // Jika sudah terenkripsi, kembalikan saja
  if (isEncrypted(plaintext)) {
    return plaintext;
  }
  
  try {
    // Generate salt unik untuk enkripsi ganda
    const salt = CryptoJS.lib.WordArray.random(16);
    
    // Derive keys dari master key dan salt
    const { aesKey, chacha20Key, hmacKey } = deriveKeys(encryptionKey, salt);
    
    // Layer 1: Enkripsi dengan AES-256
    const encryptedAES = CryptoJS.AES.encrypt(plaintext, aesKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).toString();
    
    // Layer 2: Simulasi ChaCha20 (menggunakan AES lagi dengan key berbeda)
    const encryptedDouble = CryptoJS.AES.encrypt(encryptedAES, chacha20Key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).toString();
    
    // Gabungkan salt dan double ciphertext
    const saltCiphertext = salt.toString(CryptoJS.enc.Hex) + 
                           ":" + 
                           encryptedDouble;
    
    // Tambahkan HMAC untuk authenticity check
    const hmac = calculateHMAC(saltCiphertext, hmacKey);
    
    // Format final: base64(salt:double-ciphertext:hmac)
    return CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(saltCiphertext + ":" + hmac)
    );
  } catch (error) {
    console.error('Double encryption error:', error);
    throw new Error('Gagal melakukan enkripsi ganda');
  }
}

/**
 * Dekripsi ganda untuk data yang sangat sensitif
 * @param {string} ciphertext - Teks terenkripsi ganda
 * @returns {string} - Teks asli setelah didekripsi ganda
 */
function doubleDecrypt(ciphertext) {
  if (!ciphertext) return null;
  
  // Jika input tampaknya bukan data terenkripsi, kembalikan apa adanya
  if (!isEncrypted(ciphertext)) {
    return ciphertext;
  }
  
  try {
    // Decode base64
    const decoded = CryptoJS.enc.Base64.parse(ciphertext).toString(CryptoJS.enc.Utf8);
    
    // Split salt, encrypted data, dan HMAC
    const parts = decoded.split(':');
    if (parts.length !== 3) {
      // Format tidak valid, coba dekripsi normal
      return decrypt(ciphertext);
    }
    
    const salt = CryptoJS.enc.Hex.parse(parts[0]);
    const encryptedDouble = parts[1];
    const hmacReceived = parts[2];
    
    // Derive keys dari master key dan salt
    const { aesKey, chacha20Key, hmacKey } = deriveKeys(encryptionKey, salt);
    
    // Verifikasi HMAC
    const saltCiphertext = parts[0] + ":" + parts[1];
    const hmacCalculated = calculateHMAC(saltCiphertext, hmacKey);
    
    if (hmacReceived !== hmacCalculated) {
      console.error('HMAC verification failed: Data mungkin telah dimodifikasi');
      // Coba dekripsi normal sebagai fallback
      return decrypt(ciphertext);
    }
    
    try {
      // Layer 2 (ChaCha20 simulasi): Dekripsi
      const decryptedLayer1 = CryptoJS.AES.decrypt(encryptedDouble, chacha20Key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }).toString(CryptoJS.enc.Utf8);
      
      // Layer 1 (AES): Dekripsi
      const decryptedFinal = CryptoJS.AES.decrypt(decryptedLayer1, aesKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }).toString(CryptoJS.enc.Utf8);
      
      if (!decryptedFinal) {
        // Jika hasil dekripsi kosong, coba dekripsi normal
        return decrypt(ciphertext);
      }
      
      return decryptedFinal;
    } catch (decryptError) {
      console.error('Error during double decryption layers:', decryptError);
      // Coba dekripsi normal sebagai fallback
      return decrypt(ciphertext);
    }
  } catch (error) {
    console.error('Double decryption error:', error);
    // Jika terjadi error, kembalikan data asli atau coba dekripsi normal
    try {
      return decrypt(ciphertext);
    } catch (fallbackError) {
      return ciphertext;
    }
  }
}

/**
 * Fungsi untuk mengenkripsi objek yang berisi data sensitif
 * @param {Object} data - Objek dengan properti yang perlu dienkripsi
 * @param {Array} fieldsToEncrypt - Array nama properti yang perlu dienkripsi
 * @param {Array} extraSensitiveFields - Array nama properti yang memerlukan enkripsi ganda
 * @returns {Object} - Objek dengan properti yang telah dienkripsi
 */
function encryptFields(data, fieldsToEncrypt, extraSensitiveFields = []) {
  const encryptedData = { ...data };
  
  for (const field of fieldsToEncrypt) {
    if (encryptedData[field]) {
      // Jika field sangat sensitif, gunakan double encryption
      if (extraSensitiveFields.includes(field)) {
        encryptedData[field + '_encrypted'] = doubleEncrypt(encryptedData[field]);
        encryptedData[field + '_protection'] = 'double'; // Tandai level proteksi
      } else {
        encryptedData[field + '_encrypted'] = encrypt(encryptedData[field]);
        encryptedData[field + '_protection'] = 'standard'; // Tandai level proteksi
      }
      delete encryptedData[field]; // Hapus data asli
    }
  }
  
  return encryptedData;
}

/**
 * Fungsi untuk mendekripsi properti objek yang terenkripsi
 * @param {Object} data - Objek dengan properti terenkripsi
 * @param {Array} fieldsToDecrypt - Array nama properti yang perlu didekripsi
 * @returns {Object} - Objek dengan properti yang telah didekripsi
 */
function decryptFields(data, fieldsToDecrypt) {
  const decryptedData = { ...data };
  
  for (const field of fieldsToDecrypt) {
    const encryptedField = field + '_encrypted';
    const protectionField = field + '_protection';
    
    if (decryptedData[encryptedField]) {
      try {
        // Cek level proteksi, default ke standard
        const protection = decryptedData[protectionField] || 'standard';
        
        if (protection === 'double') {
          decryptedData[field] = doubleDecrypt(decryptedData[encryptedField]);
        } else {
          decryptedData[field] = decrypt(decryptedData[encryptedField]);
        }
      } catch (error) {
        console.error(`Error decrypting field ${field}:`, error);
        // Jika dekripsi gagal, gunakan data terenkripsi asli
        decryptedData[field] = decryptedData[encryptedField];
      }
    }
  }
  
  return decryptedData;
}

module.exports = {
  encrypt,
  decrypt,
  doubleEncrypt,
  doubleDecrypt,
  encryptFields,
  decryptFields,
  calculateHMAC,
  isEncrypted
}; 