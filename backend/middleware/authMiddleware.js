// File: backend/middleware/authMiddleware.js

import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Middleware untuk memeriksa token (sudah login atau belum)
export const protect = async (req, res, next) => {
  let token;

  // Token dikirim di header 'Authorization' dengan format 'Bearer [token]'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Ambil token dari header
      token = req.headers.authorization.split(' ')[1];

      // 2. Verifikasi token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Ambil data user dari token (tanpa password) dan simpan di 'req.user'
      req.user = await User.findById(decoded.userId).select('-password'); 

      next(); // Lanjut ke rute yang dituju
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ error: "Tidak terotorisasi, token gagal." });
    }
  }

  if (!token) {
    res.status(401).json({ error: "Tidak terotorisasi, tidak ada token." });
  }
};

// Middleware untuk memeriksa ROLE (admin atau bukan)
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next(); // Jika 'admin', izinkan lanjut
  } else {
    res.status(403).json({ error: "Tidak terotorisasi. Hanya admin yang diizinkan." });
  }
};