// File: backend/routes/auth.js

import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// --- [POST] /api/auth/register ---
router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Cek jika email sudah terdaftar
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email sudah terdaftar." });
    }

    // Buat user baru (Password akan di-hash otomatis oleh hook di User.js)
    const newUser = new User({ email, password, role });
    await newUser.save();

    res.status(201).json({ message: "Registrasi berhasil!", userId: newUser._id, role: newUser.role });

  } catch (error) {
    res.status(500).json({ error: "Gagal mendaftar.", details: error.message });
  }
});

// --- [POST] /api/auth/login ---
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Cari user berdasarkan email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Email atau password salah." });
    }

    // 2. Bandingkan password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Email atau password salah." });
    }

    // 3. Buat Token (JWT)
    // Token ini adalah "tiket" yang membuktikan user sudah login
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role // Simpan role di dalam token
      },
      process.env.JWT_SECRET, // Ambil dari file .env
      { expiresIn: '10h' } 
    );

    res.json({ 
      message: "Login berhasil!", 
      token: token,
      role: user.role
    });

  } catch (error) {
    res.status(500).json({ error: "Gagal login.", details: error.message });
  }
});

export default router;