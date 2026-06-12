import jwt  from "jsonwebtoken";
import User from "../models/User.js";

// Middleware: verifikasi JWT Bearer token
export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Ambil data user dari DB (tanpa password)
            req.user = await User.findById(decoded.userId).select("-password");

            if (!req.user) {
                return res.status(401).json({ error: "User tidak ditemukan." });
            }

            next();
        } catch (error) {
            console.error("Token verification failed:", error.message);
            return res.status(401).json({ error: "Tidak terotorisasi, token tidak valid." });
        }
    }

    if (!token) {
        return res.status(401).json({ error: "Tidak terotorisasi, tidak ada token." });
    }
};

// Middleware: cek role admin
export const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ error: "Tidak terotorisasi. Hanya admin yang diizinkan." });
    }
};
