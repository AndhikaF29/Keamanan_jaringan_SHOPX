# ShopX - E-Commerce dengan Enkripsi Data AES-256

ShopX adalah website e-commerce yang mengutamakan keamanan data pengguna dengan mengimplementasikan enkripsi AES-256 untuk data sensitif.

## Studi Kasus
Pengamanan Data Pengguna pada Website E-Commerce ShopX yang menangani data sensitif pengguna, seperti:
- Informasi pribadi (nama, alamat, nomor telepon)
- Data pembayaran (nomor kartu kredit, CVV)
- Riwayat pembelian

Untuk memenuhi standar keamanan data (seperti GDPR dan PCI-DSS), website menggunakan AES-256 untuk mengenkripsi data sensitif yang disimpan di database.

## Deskripsi Teknis
- Setiap data sensitif yang dikirim dari frontend ke server dienkripsi sebelum disimpan.
- Kunci enkripsi AES-256 disimpan di file konfigurasi (.env) dan dalam implementasi nyata akan disimpan di sistem yang terpisah dan aman (seperti Key Management Service - KMS).
- Data akan didekripsi hanya saat benar-benar dibutuhkan, misalnya saat memproses pembayaran atau menampilkan riwayat pesanan pengguna.

## Fitur Aplikasi
- Registrasi dan login pengguna
- Manajemen profil pengguna dengan enkripsi data pribadi
- Penyimpanan informasi pembayaran dengan enkripsi AES-256
- Katalog produk
- Keranjang belanja
- Checkout dengan enkripsi alamat pengiriman
- Riwayat pesanan dengan dekripsi data saat dibutuhkan

## Teknologi yang Digunakan
- **Backend**: Node.js dengan Express
- **Database**: MySQL
- **Template Engine**: EJS
- **Enkripsi**: AES-256 (crypto-js)
- **Hash Password**: bcrypt
- **Frontend**: Bootstrap 5, HTML, CSS, JavaScript

## Implementasi Keamanan
1. **Enkripsi Data Sensitif**:
   - Alamat dan nomor telepon pengguna dienkripsi dengan AES-256
   - Informasi kartu kredit dienkripsi dengan AES-256
   - Alamat pengiriman pada pesanan dienkripsi dengan AES-256

2. **Hashing Password**:
   - Password pengguna di-hash menggunakan bcrypt

3. **Dekripsi Data**:
   - Data sensitif hanya didekripsi saat benar-benar dibutuhkan
   - Semua data dalam database disimpan dalam bentuk terenkripsi

## Struktur Database
Database terdiri dari beberapa tabel utama:
- `users`: Informasi pengguna (dengan alamat dan nomor telepon terenkripsi)
- `payment_info`: Informasi pembayaran (data kartu kredit terenkripsi)
- `products`: Katalog produk
- `cart`: Keranjang belanja pengguna
- `orders`: Pesanan (dengan alamat pengiriman terenkripsi)
- `order_items`: Item-item dalam pesanan

## Instalasi dan Menjalankan Aplikasi

### Prasyarat
- Node.js (v14 atau lebih baru)
- MySQL Server

### Langkah Instalasi
1. Clone repositori ini
   ```bash
   git clone https://github.com/username/shopx-ecommerce.git
   cd shopx-ecommerce
   ```

2. Install dependensi
   ```bash
   npm install
   ```

3. Setup database MySQL
   ```sql
   CREATE DATABASE shopx_db;
   ```

4. Konfigurasi file .env dengan kredensial database dan kunci enkripsi Anda
   ```
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=shopx_db
   SESSION_SECRET=your_session_secret
   ENCRYPTION_KEY=your_32_byte_encryption_key_in_hex
   ENCRYPTION_IV=your_16_byte_iv_in_hex
   ```

5. Jalankan aplikasi
   ```bash
   npm start
   ```

6. Buka browser dan akses `http://localhost:3000`

## Kebutuhan Keamanan
- Dalam implementasi produksi, kunci enkripsi harus disimpan di layanan manajemen kunci terpisah (seperti AWS KMS, Azure Key Vault, dll.) bukan di file .env.
- Gunakan HTTPS untuk semua komunikasi di lingkungan produksi.
- Terapkan pembatasan akses dan otorisasi yang tepat untuk setiap endpoint API.
- Lakukan audit keamanan dan pengujian penetrasi secara berkala.

## Lisensi
MIT License

## Kontributor
- [Nama Anda]

---

*Catatan: Aplikasi ini dibuat sebagai studi kasus untuk implementasi enkripsi data pada aplikasi e-commerce dan tidak direkomendasikan untuk digunakan dalam produksi tanpa audit keamanan menyeluruh.* 