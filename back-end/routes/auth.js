import express from "express";
import User    from "../models/User.js";
import jwt     from "jsonwebtoken";

const router = express.Router();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// --- [POST] /api/auth/register ---
router.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email dan password wajib diisi." });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: "Format email tidak valid." });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password minimal 6 karakter." });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: "Email sudah terdaftar." });
        }

        // SECURITY: Role TIDAK bisa diset dari request — selalu 'user'
        const newUser = new User({ email: email.toLowerCase(), password, role: "user" });
        await newUser.save();

        res.status(201).json({ message: "Registrasi berhasil!", userId: newUser._id });

    } catch (error) {
        console.error("❌ [Register] Error:", error);
        res.status(500).json({ error: "Gagal mendaftar." });
    }
});

// --- [POST] /api/auth/login ---
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email dan password wajib diisi." });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        // Pesan generik untuk mencegah user enumeration
        if (!user) {
            return res.status(401).json({ error: "Email atau password salah." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: "Email atau password salah." });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "10h" }
        );

        res.json({
            message: "Login berhasil!",
            token,
            role:    user.role,
            email:   user.email,
        });

    } catch (error) {
        console.error("❌ [Login] Error:", error);
        res.status(500).json({ error: "Gagal login." });
    }
});

export default router;
