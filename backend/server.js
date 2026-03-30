import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

// 1. IMPORT SEMUA RUTE
import adminRoutes from "./routes/admin.js";
import chatRoutes from "./routes/chat.js"; 
import authRoutes from "./routes/auth.js";
import submissionRoutes from "./routes/Submission.js";
import publicChatRoutes from "./routes/publicChat.js"; 

// 2. IMPORT HELPER SINKRONISASI (Ganti yang lama)
import { syncEmbeddingsToAtlas } from "./utils/ragHelper.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Koneksi Database
mongoose
  .connect(process.env.MONGO_URI, { ssl: true })
  .then(async () => {
    console.log("✅ Connected to MongoDB Atlas");
    
    // 3. JALANKAN SINKRONISASI EMBEDDING
    // Ini akan otomatis mengisi field 'embedding' jika ada data baru/kosong di DB
    console.log("🚀 Menjalankan sinkronisasi embedding ke Atlas...");
    await syncEmbeddingsToAtlas();
    
    console.log("✅ Chatbot Vector Search siap digunakan!");
    
    // 4. DAFTARKAN SEMUA RUTE - SETELAH DB SIAP
    app.use("/api/auth", authRoutes); 
    app.use("/api/admin", adminRoutes);
    app.use("/api/chat", chatRoutes); 
    app.use("/api/submission", submissionRoutes);
    app.use("/api/public-chat", publicChatRoutes);
    
    console.log("✅ Semua routes berhasil didaftarkan!");
    
    // 5. START SERVER - SETELAH SEMUA SIAP
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch((err) => console.error("❌ Could not connect to MongoDB Atlas:", err));

app.get("/", (req, res) => res.send("🚀 Chatbot backend with Atlas Vector Search is running!"));