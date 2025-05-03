const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const PaymentInfo = require('../models/PaymentInfo');
const router = express.Router();

// Middleware untuk memeriksa apakah pengguna sudah login
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Halaman checkout
router.get('/checkout', requireLogin, async (req, res) => {
  try {
    // Ambil item keranjang
    const cartItems = await Cart.getByUserId(req.session.user.id);
    
    if (cartItems.length === 0) {
      return res.redirect('/cart');
    }
    
    const cartTotal = await Cart.getCartTotal(req.session.user.id);
    
    // Ambil informasi pembayaran yang tersimpan (jika ada)
    const paymentInfo = await PaymentInfo.getByUserId(req.session.user.id);
    
    res.render('checkout', { 
      cartItems, 
      cartTotal,
      paymentInfo,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error rendering checkout page:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat halaman checkout' });
  }
});

// Proses checkout dan buat pesanan
router.post('/checkout', requireLogin, async (req, res) => {
  try {
    const { 
      shipping_address,
      payment_method,
      card_number,
      card_holder,
      expiry_date,
      cvv
    } = req.body;
    
    // Validasi alamat pengiriman
    if (!shipping_address) {
      const cartItems = await Cart.getByUserId(req.session.user.id);
      const cartTotal = await Cart.getCartTotal(req.session.user.id);
      const paymentInfo = await PaymentInfo.getByUserId(req.session.user.id);
      
      return res.render('checkout', {
        cartItems,
        cartTotal,
        paymentInfo,
        user: req.session.user,
        error: 'Alamat pengiriman tidak boleh kosong'
      });
    }
    
    // Ambil item keranjang
    const cartItems = await Cart.getByUserId(req.session.user.id);
    const cartTotal = await Cart.getCartTotal(req.session.user.id);
    
    if (cartItems.length === 0) {
      return res.redirect('/cart');
    }
    
    // Untuk pembayaran dengan kartu kredit, simpan informasi pembayaran
    if (payment_method === 'credit_card' && card_number && card_holder && expiry_date && cvv) {
      // Simpan atau update informasi pembayaran (terenkripsi)
      const existingPaymentInfo = await PaymentInfo.getByUserId(req.session.user.id);
      
      if (existingPaymentInfo) {
        await PaymentInfo.update(existingPaymentInfo.id, {
          user_id: req.session.user.id,
          card_number,
          card_holder,
          expiry_date,
          cvv
        });
      } else {
        await PaymentInfo.save({
          user_id: req.session.user.id,
          card_number,
          card_holder,
          expiry_date,
          cvv
        });
      }
    }
    
    // Buat pesanan dengan alamat pengiriman terenkripsi
    const order = await Order.create(
      {
        user_id: req.session.user.id,
        shipping_address: shipping_address,
        total_amount: cartTotal.total_price
      },
      // Format item pesanan untuk model
      cartItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      }))
    );
    
    // Redirect ke halaman konfirmasi
    res.redirect(`/orders/confirmation/${order.id}`);
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memproses pesanan' });
  }
});

// Halaman konfirmasi pesanan
router.get('/confirmation/:orderId', requireLogin, async (req, res) => {
  try {
    const order = await Order.getById(req.params.orderId);
    
    if (!order || order.user_id !== req.session.user.id) {
      return res.status(404).render('404');
    }
    
    res.render('order-confirmation', { 
      order,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing order confirmation:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat halaman konfirmasi' });
  }
});

// Halaman daftar pesanan
router.get('/history', requireLogin, async (req, res) => {
  try {
    const orders = await Order.getByUserId(req.session.user.id);
    
    res.render('order-history', { 
      orders,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing order history:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat riwayat pesanan' });
  }
});

// Halaman detail pesanan
router.get('/detail/:orderId', requireLogin, async (req, res) => {
  try {
    const order = await Order.getById(req.params.orderId);
    
    if (!order || order.user_id !== req.session.user.id) {
      return res.status(404).render('404');
    }
    
    res.render('order-detail', { 
      order,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing order detail:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat detail pesanan' });
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

// Halaman admin daftar pesanan
router.get('/admin/list', requireLogin, requireAdmin, async (req, res) => {
  try {
    // Di implementasi asli, ini akan mengambil semua pesanan dari semua pengguna
    const [orders] = await require('../config/database').query(
      `SELECT o.*, u.username, u.email, u.full_name 
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );
    
    // Dekripsi alamat pengiriman untuk setiap pesanan
    for (const order of orders) {
      const decryptedOrder = require('../utils/encryption').decryptFields(
        { shipping_address_encrypted: order.shipping_address_encrypted },
        ['shipping_address']
      );
      
      order.shipping_address = decryptedOrder.shipping_address;
      delete order.shipping_address_encrypted;
    }
    
    res.render('admin/orders', { 
      orders,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing admin orders:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat daftar pesanan' });
  }
});

// Halaman admin detail pesanan
router.get('/admin/detail/:orderId', requireLogin, requireAdmin, async (req, res) => {
  try {
    const order = await Order.getById(req.params.orderId);
    
    if (!order) {
      return res.status(404).render('404');
    }
    
    // Ambil informasi pengguna
    const [users] = await require('../config/database').query(
      'SELECT username, email, full_name FROM users WHERE id = ?',
      [order.user_id]
    );
    
    res.render('admin/order-detail', { 
      order,
      customer: users[0],
      user: req.session.user
    });
  } catch (error) {
    console.error('Error showing admin order detail:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat detail pesanan' });
  }
});

// API update status pesanan
router.post('/admin/update-status/:orderId', requireLogin, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid' });
    }
    
    await Order.updateStatus(req.params.orderId, status);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengupdate status pesanan' });
  }
});

module.exports = router; 