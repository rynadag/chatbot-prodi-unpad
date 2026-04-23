import "dotenv/config";
import express    from "express";
import mongoose   from "mongoose";
import cors       from "cors";
import rateLimit  from "express-rate-limit";

import adminRoutes      from "./routes/admin.js";
import chatRoutes       from "./routes/chat.js";
import authRoutes       from "./routes/auth.js";
import submissionRoutes from "./routes/Submission.js";
import publicChatRoutes from "./routes/publicChat.js";

import { syncEmbeddingsToAtlas } from "./utils/ragHelper.js";

const app  = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ── CORS ─────────────────────────────────────────────────────
// Set WORDPRESS_URL in .env to restrict origin in production.
// e.g. WORDPRESS_URL=https://mim.feb.unpad.ac.id
const allowedOrigins = process.env.WORDPRESS_URL
    ? [process.env.WORDPRESS_URL]
    : true; // allow all in development

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ─────────────────────────────────────────────
// Global: 200 req/15min per IP
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Terlalu banyak permintaan. Coba lagi nanti." },
}));

// Chat-specific: 30 req/15min per IP (prevents LLM API abuse)
const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: "Batas permintaan chat tercapai. Tunggu beberapa menit." },
});

// ── Routes ───────────────────────────────────────────────────
app.use("/api/auth",        authRoutes);
app.use("/api/admin",       adminRoutes);
app.use("/api/chat",        chatLimiter, chatRoutes);
app.use("/api/submission",  submissionRoutes);
app.use("/api/public-chat", chatLimiter, publicChatRoutes);

// ── Utility endpoints ─────────────────────────────────────────
app.get("/", (_req, res) => res.send("🚀 Chatbot MIM FEB Unpad berjalan!"));

app.get("/health", (_req, res) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    res.json({
        status:    "ok",
        db:        states[mongoose.connection.readyState] ?? "unknown",
        llm:       process.env.LLM_PROVIDER ?? "groq",
        embedding: process.env.EMBEDDING_PROVIDER ?? "ollama",
        uptime:    Math.round(process.uptime()) + "s",
    });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("❌ Unhandled error:", err);
    res.status(500).json({ error: "Terjadi kesalahan server." });
});

// ── DB connection → start ─────────────────────────────────────
mongoose
    .connect(process.env.MONGO_URI, { ssl: true })
    .then(async () => {
        console.log("✅ Connected to MongoDB Atlas");

        // Non-blocking embedding sync — server starts immediately
        syncEmbeddingsToAtlas().catch(err =>
            console.error("⚠️ Background embedding sync gagal:", err)
        );

        app.listen(PORT, () =>
            console.log(`🚀 Server running → http://localhost:${PORT}`)
        );
    })
    .catch(err => {
        console.error("❌ Gagal koneksi ke MongoDB Atlas:", err);
        process.exit(1);
    });
