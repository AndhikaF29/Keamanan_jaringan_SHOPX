const express = require('express');
const Product = require('../models/Product');
const router = express.Router();

// Middleware untuk memeriksa apakah pengguna sudah login
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Route untuk menampilkan semua produk dengan pagination dan filter
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, category, search } = req.query;
    
    const products = await Product.getAll({
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      search
    });
    
    // Mendapatkan daftar kategori untuk filter
    const [categories] = await require('../config/database').query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL'
    );
    
    res.render('products', { 
      products, 
      currentPage: parseInt(page),
      limit: parseInt(limit),
      category,
      search,
      categories: categories.map(c => c.category),
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat produk' });
  }
});

// Route untuk detail produk
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.getById(req.params.id);
    
    if (!product) {
      return res.status(404).render('404');
    }
    
    // Mendapatkan produk terkait dari kategori yang sama
    const relatedProducts = await Product.getByCategory(product.category);
    
    res.render('product-detail', { 
      product, 
      relatedProducts: relatedProducts.filter(p => p.id !== product.id).slice(0, 4),
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Error getting product details:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat detail produk' });
  }
});

// Route untuk mencari produk
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.redirect('/products');
    }
    
    const products = await Product.search(q);
    
    res.render('search-results', { 
      products, 
      query: q,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.render('error', { error: 'Terjadi kesalahan saat mencari produk' });
  }
});

// Route untuk kategori produk
router.get('/category/:category', async (req, res) => {
  try {
    const products = await Product.getByCategory(req.params.category);
    
    res.render('category', { 
      products, 
      category: req.params.category,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Error getting category products:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat produk kategori' });
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

// Halaman admin produk
router.get('/admin/list', requireLogin, requireAdmin, async (req, res) => {
  try {
    const products = await Product.getAll({ limit: 100 });
    
    res.render('admin/products', { 
      products, 
      user: req.session.user
    });
  } catch (error) {
    console.error('Error getting admin products:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat produk' });
  }
});

// Halaman tambah produk baru
router.get('/admin/add', requireLogin, requireAdmin, (req, res) => {
  res.render('admin/product-form', { 
    product: null, 
    action: 'add',
    user: req.session.user
  });
});

// Proses tambah produk baru
router.post('/admin/add', requireLogin, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, image_url, stock, category } = req.body;
    
    const product = await Product.create({
      name,
      description,
      price: parseFloat(price),
      image_url,
      stock: parseInt(stock),
      category
    });
    
    res.redirect('/products/admin/list');
  } catch (error) {
    console.error('Error adding product:', error);
    res.render('admin/product-form', { 
      product: req.body, 
      action: 'add',
      error: 'Terjadi kesalahan saat menyimpan produk',
      user: req.session.user
    });
  }
});

// Halaman edit produk
router.get('/admin/edit/:id', requireLogin, requireAdmin, async (req, res) => {
  try {
    const product = await Product.getById(req.params.id);
    
    if (!product) {
      return res.status(404).render('404');
    }
    
    res.render('admin/product-form', { 
      product, 
      action: 'edit',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error getting product for edit:', error);
    res.render('error', { error: 'Terjadi kesalahan saat memuat produk' });
  }
});

// Proses edit produk
router.post('/admin/edit/:id', requireLogin, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, image_url, stock, category } = req.body;
    
    const product = await Product.update(req.params.id, {
      name,
      description,
      price: parseFloat(price),
      image_url,
      stock: parseInt(stock),
      category
    });
    
    res.redirect('/products/admin/list');
  } catch (error) {
    console.error('Error updating product:', error);
    res.render('admin/product-form', { 
      product: { ...req.body, id: req.params.id }, 
      action: 'edit',
      error: 'Terjadi kesalahan saat mengupdate produk',
      user: req.session.user
    });
  }
});

// Proses hapus produk
router.post('/admin/delete/:id', requireLogin, requireAdmin, async (req, res) => {
  try {
    await Product.delete(req.params.id);
    
    res.redirect('/products/admin/list');
  } catch (error) {
    console.error('Error deleting product:', error);
    res.render('error', { error: 'Terjadi kesalahan saat menghapus produk' });
  }
});

module.exports = router; 