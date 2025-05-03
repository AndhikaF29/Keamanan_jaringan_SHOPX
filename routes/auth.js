const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Middleware untuk memeriksa apakah pengguna sudah login
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Middleware untuk memeriksa apakah pengguna belum login
const redirectIfLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
};

// Route untuk halaman landing
router.get('/', (req, res) => {
  res.render('landing', { user: req.session.user || null });
});

// Route untuk halaman login
router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('login', { error: null });
});

// Proses login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.login(email, password);
    
    // Simpan user di session (tanpa password)
    req.session.user = user;
    
    res.redirect('/dashboard');
  } catch (error) {
    res.render('login', { error: 'Email atau password salah' });
  }
});

// Route untuk halaman register
router.get('/register', redirectIfLoggedIn, (req, res) => {
  res.render('register', { error: null });
});

// Proses register
router.post('/register', async (req, res) => {
  const { username, email, password, full_name } = req.body;
  
  try {
    // Validasi dasar
    if (!username || !email || !password || !full_name) {
      return res.render('register', { error: 'Semua field harus diisi' });
    }
    
    if (password.length < 6) {
      return res.render('register', { error: 'Password minimal 6 karakter' });
    }
    
    // Daftarkan pengguna baru
    const user = await User.register({
      username,
      email,
      password,
      full_name
    });
    
    // Login otomatis setelah registrasi
    req.session.user = user;
    
    res.redirect('/dashboard');
  } catch (error) {
    let errorMessage = 'Terjadi kesalahan saat register';
    
    // Cek kesalahan duplikat (username/email sudah digunakan)
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('username')) {
        errorMessage = 'Username sudah digunakan';
      } else if (error.message.includes('email')) {
        errorMessage = 'Email sudah digunakan';
      }
    }
    
    res.render('register', { error: errorMessage });
  }
});

// Route untuk logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Route untuk dashboard (halaman utama setelah login)
router.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

// Route untuk halaman profile
router.get('/profile', requireLogin, async (req, res) => {
  try {
    // Ambil data user terbaru (dengan alamat dan nomor telepon terdekripsi)
    const user = await User.getById(req.session.user.id);
    
    res.render('profile', { user, error: null, success: null });
  } catch (error) {
    res.render('error', { error: 'Terjadi kesalahan saat mengambil data profil' });
  }
});

// Proses update profile
router.post('/profile', requireLogin, async (req, res) => {
  const { full_name, address, phone_number } = req.body;
  
  try {
    // Update profil pengguna
    const updatedUser = await User.update(req.session.user.id, {
      full_name,
      address,
      phone_number
    });
    
    // Update session dengan data terbaru
    req.session.user = updatedUser;
    
    res.render('profile', { 
      user: updatedUser, 
      error: null, 
      success: 'Profil berhasil diperbarui' 
    });
  } catch (error) {
    res.render('profile', { 
      user: req.session.user, 
      error: 'Terjadi kesalahan saat memperbarui profil', 
      success: null 
    });
  }
});

module.exports = router; 