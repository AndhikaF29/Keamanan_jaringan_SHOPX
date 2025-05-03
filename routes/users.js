const express = require('express');
const User = require('../models/User');
const PaymentInfo = require('../models/PaymentInfo');
const router = express.Router();

// Middleware untuk memeriksa apakah pengguna sudah login
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Route untuk halaman profil pengguna
router.get('/profile', requireLogin, async (req, res) => {
  try {
    // Ambil data user terbaru (dengan alamat dan nomor telepon terdekripsi)
    const user = await User.getById(req.session.user.id);
    
    res.render('profile', { 
      user, 
      error: null, 
      success: null 
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat profil' });
  }
});

// Route untuk memperbarui profil pengguna
router.post('/profile', requireLogin, async (req, res) => {
  try {
    const { full_name, address, phone_number } = req.body;
    
    // Update profil pengguna dengan data terenkripsi
    const updatedUser = await User.update(req.session.user.id, {
      full_name,
      address,
      phone_number
    });
    
    // Update session dengan data terbaru
    req.session.user = {
      ...req.session.user,
      full_name: updatedUser.full_name,
      address: updatedUser.address,
      phone_number: updatedUser.phone_number
    };
    
    res.render('profile', { 
      user: updatedUser,
      error: null,
      success: 'Profil berhasil diperbarui'
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.render('profile', { 
      user: req.session.user,
      error: 'Terjadi kesalahan saat memperbarui profil',
      success: null
    });
  }
});

// Route untuk halaman informasi pembayaran
router.get('/payment-info', requireLogin, async (req, res) => {
  try {
    // Ambil informasi pembayaran terdekripsi
    const paymentInfo = await PaymentInfo.getByUserId(req.session.user.id);
    
    res.render('payment-info', { 
      paymentInfo, 
      user: req.session.user,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Error getting payment info:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat informasi pembayaran' });
  }
});

// Route untuk menyimpan/memperbarui informasi pembayaran
router.post('/payment-info', requireLogin, async (req, res) => {
  try {
    const { card_number, card_holder, expiry_date, cvv } = req.body;
    
    // Validasi dasar
    if (!card_number || !card_holder || !expiry_date || !cvv) {
      const paymentInfo = await PaymentInfo.getByUserId(req.session.user.id);
      
      return res.render('payment-info', {
        paymentInfo,
        user: req.session.user,
        error: 'Semua field harus diisi',
        success: null
      });
    }
    
    // Cek apakah pengguna sudah memiliki informasi pembayaran
    const existingPaymentInfo = await PaymentInfo.getByUserId(req.session.user.id);
    
    if (existingPaymentInfo) {
      // Update informasi pembayaran yang ada
      await PaymentInfo.update(existingPaymentInfo.id, {
        user_id: req.session.user.id,
        card_number,
        card_holder,
        expiry_date,
        cvv
      });
    } else {
      // Simpan informasi pembayaran baru
      await PaymentInfo.save({
        user_id: req.session.user.id,
        card_number,
        card_holder,
        expiry_date,
        cvv
      });
    }
    
    // Ambil informasi pembayaran yang baru diperbarui
    const paymentInfo = await PaymentInfo.getByUserId(req.session.user.id);
    
    res.render('payment-info', {
      paymentInfo,
      user: req.session.user,
      error: null,
      success: 'Informasi pembayaran berhasil disimpan'
    });
  } catch (error) {
    console.error('Error saving payment info:', error);
    res.render('payment-info', {
      paymentInfo: null,
      user: req.session.user,
      error: 'Terjadi kesalahan saat menyimpan informasi pembayaran',
      success: null
    });
  }
});

// Route untuk menghapus informasi pembayaran
router.post('/payment-info/delete', requireLogin, async (req, res) => {
  try {
    const { payment_info_id } = req.body;
    
    // Verifikasi bahwa informasi pembayaran milik pengguna
    const isOwner = await PaymentInfo.verifyOwnership(req.session.user.id, payment_info_id);
    
    if (!isOwner) {
      return res.status(403).render('error', { error: 'Akses ditolak' });
    }
    
    // Hapus informasi pembayaran
    await PaymentInfo.delete(payment_info_id, req.session.user.id);
    
    res.render('payment-info', {
      paymentInfo: null,
      user: req.session.user,
      error: null,
      success: 'Informasi pembayaran berhasil dihapus'
    });
  } catch (error) {
    console.error('Error deleting payment info:', error);
    res.render('error', { error: 'Terjadi kesalahan saat menghapus informasi pembayaran' });
  }
});

// ==================== Admin Routes ====================
// Middleware admin only
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { error: 'Akses ditolak' });
  }
  next();
};

// Halaman admin daftar pengguna
router.get('/admin/list', requireLogin, requireAdmin, async (req, res) => {
  try {
    // Ambil daftar pengguna tanpa data sensitif
    const [users] = await require('../config/database').query(
      'SELECT id, username, email, full_name, created_at FROM users ORDER BY created_at DESC'
    );
    
    res.render('admin/users', { 
      users,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing admin users:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat daftar pengguna' });
  }
});

module.exports = router; 