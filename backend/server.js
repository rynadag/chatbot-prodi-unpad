import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import adminRoutes from "./routes/admin.js";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import submissionRoutes from "./routes/Submission.js";
import publicChatRoutes from "./routes/publicChat.js";

import { syncEmbeddingsToAtlas } from "./utils/ragHelper.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(cors());

// Daftarkan semua routes SEBELUM koneksi DB — express tetap berjalan,
// request akan menunggu DB siap via getVectorStore/singleton.
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/submission", submissionRoutes);
app.use("/api/public-chat", publicChatRoutes);

app.get("/", (req, res) => res.send("🚀 Chatbot Prodi Unpad berjalan!"));

// Health check endpoint
app.get("/health", (req, res) => {
    const dbState = ["disconnected", "connected", "connecting", "disconnecting"];
    res.json({
        status: "ok",
        db: dbState[mongoose.connection.readyState] || "unknown",
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("❌ Unhandled error:", err);
    res.status(500).json({ error: "Terjadi kesalahan server." });
});

// Koneksi Database
mongoose
    .connect(process.env.MONGO_URI, { ssl: true })
    .then(async () => {
        console.log("✅ Connected to MongoDB Atlas");

        // Jalankan sinkronisasi embedding secara non-blocking
        // agar server tidak lambat saat startup jika ada banyak data baru
        syncEmbeddingsToAtlas().catch(err =>
            console.error("⚠️ Sinkronisasi embedding background gagal:", err)
        );

        app.listen(PORT, () =>
            console.log(`🚀 Server running on http://localhost:${PORT}`)
        );
    })
    .catch((err) => {
        console.error("❌ Could not connect to MongoDB Atlas:", err);
        process.exit(1); // Keluar dengan error jika DB tidak bisa terkoneksi
    });
