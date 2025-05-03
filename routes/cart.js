const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const router = express.Router();

// Middleware untuk memeriksa apakah pengguna sudah login
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Halaman keranjang belanja
router.get('/', requireLogin, async (req, res) => {
  try {
    const cartItems = await Cart.getByUserId(req.session.user.id);
    const cartTotal = await Cart.getCartTotal(req.session.user.id);
    
    res.render('cart', { 
      cartItems, 
      cartTotal,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat keranjang' });
  }
});

// API Tambah ke keranjang
router.post('/add', requireLogin, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    
    // Validasi produk ada
    const product = await Product.getById(product_id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }
    
    // Validasi stok cukup
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Stok produk tidak mencukupi' });
    }
    
    // Tambahkan ke keranjang
    const cartItem = await Cart.addItem({
      user_id: req.session.user.id,
      product_id: parseInt(product_id),
      quantity: parseInt(quantity)
    });
    
    res.json({ success: true, cartItem });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat menambahkan ke keranjang' });
  }
});

// API Update kuantitas item di keranjang
router.post('/update/:cartId', requireLogin, async (req, res) => {
  try {
    const { quantity } = req.body;
    const cartId = parseInt(req.params.cartId);
    
    // Validasi quantity valid
    if (quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Kuantitas harus lebih dari 0' });
    }
    
    // Update kuantitas
    await Cart.updateQuantity(cartId, req.session.user.id, parseInt(quantity));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengupdate keranjang' });
  }
});

// API Hapus item dari keranjang
router.post('/remove/:cartId', requireLogin, async (req, res) => {
  try {
    const cartId = parseInt(req.params.cartId);
    
    await Cart.removeItem(cartId, req.session.user.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat menghapus item dari keranjang' });
  }
});

// API Kosongkan keranjang
router.post('/clear', requireLogin, async (req, res) => {
  try {
    await Cart.clearCart(req.session.user.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengosongkan keranjang' });
  }
});

// API Dapatkan jumlah item di keranjang (untuk badge keranjang)
router.get('/count', requireLogin, async (req, res) => {
  try {
    const cartTotal = await Cart.getCartTotal(req.session.user.id);
    
    res.json({ success: true, count: cartTotal.total_items });
  } catch (error) {
    console.error('Error getting cart count:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mendapatkan jumlah keranjang' });
  }
});

module.exports = router; 