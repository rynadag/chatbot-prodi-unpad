import express from "express";
import multer  from "multer";
import { protect, isAdmin }      from "../middleware/authMiddleware.js";
import KnowledgeSource           from "../models/KnowledgeSource.js";
import ChatSession               from "../models/ChatSession.js";
import { syncEmbeddingsToAtlas } from "../utils/ragHelper.js";

const router = express.Router();

// ── Multer: terima file JSON di memori ────────────────────────
const storage = multer.memoryStorage();
const upload  = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Batas 5 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/json" || file.originalname.endsWith(".json")) {
            cb(null, true);
        } else {
            cb(new Error("Hanya file JSON yang diizinkan."));
        }
    },
});

// Semua endpoint admin memerlukan autentikasi + role admin
router.use(protect);
router.use(isAdmin);

// ── [GET] /api/admin/data ─────────────────────────────────────
router.get("/data", async (req, res) => {
    try {
        const data = await KnowledgeSource.find({}).lean().sort({ tag: 1 });
        res.json(data);
    } catch (error) {
        console.error("❌ [Admin GET /data] Error:", error);
        res.status(500).json({ error: "Gagal mengambil data dari database." });
    }
});

// ── [POST] /api/admin/data ────────────────────────────────────
router.post("/data", async (req, res) => {
    try {
        const { tag, content_text } = req.body;
        if (!tag || !content_text) {
            return res.status(400).json({ error: "Tag dan content_text wajib diisi." });
        }

        const newData = new KnowledgeSource({
            tag: tag.trim(),
            content_text: content_text.trim(),
            embedding: [],
            embedding_provider: null,
            embedding_model: null,
            content_hash: null,
        });
        await newData.save();
        res.status(201).json(newData);
    } catch (error) {
        console.error("❌ [Admin POST /data] Error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "Tag data sudah ada di database." });
        }
        res.status(400).json({ error: "Gagal menyimpan data.", details: error.message });
    }
});

// ── [PUT] /api/admin/data/:id ─────────────────────────────────
router.put("/data/:id", async (req, res) => {
    try {
        const update = { ...req.body };

        // Reset embedding jika content berubah agar di-embed ulang
        if (update.content_text) {
            update.embedding           = [];
            update.embedding_provider  = null;
            update.embedding_model     = null;
            update.content_hash        = null;
        }

        const updatedData = await KnowledgeSource.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true, runValidators: true }
        );

        if (!updatedData) {
            return res.status(404).json({ error: "Data tidak ditemukan." });
        }
        res.json(updatedData);
    } catch (error) {
        console.error("❌ [Admin PUT /data/:id] Error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "Tag data sudah ada di database." });
        }
        res.status(400).json({ error: "Gagal memperbarui data.", details: error.message });
    }
});

// ── [DELETE] /api/admin/data/:id ──────────────────────────────
router.delete("/data/:id", async (req, res) => {
    try {
        const deleted = await KnowledgeSource.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: "Data tidak ditemukan." });
        }
        res.json({ message: "✅ Data berhasil dihapus!", deletedId: req.params.id });
    } catch (error) {
        console.error("❌ [Admin DELETE /data/:id] Error:", error);
        res.status(500).json({ error: "Gagal menghapus data.", details: error.message });
    }
});

// ── [POST] /api/admin/import — Import data dari JSON ──────────
router.post("/import", upload.single("importFile"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Tidak ada file yang di-upload." });
    }

    let data;
    try {
        const jsonString = req.file.buffer.toString("utf-8");
        data = JSON.parse(jsonString);
    } catch (error) {
        return res.status(400).json({ error: "File bukan JSON yang valid.", details: error.message });
    }

    if (!Array.isArray(data)) {
        return res.status(400).json({ error: "JSON harus berupa array (list)." });
    }

    let successCount = 0;
    let errorCount   = 0;
    const operations = [];

    for (const item of data) {
        if (item.tag && item.content_text) {
            operations.push({
                updateOne: {
                    filter: { tag: item.tag },
                    update: {
                        $set: {
                            content_text:       item.content_text,
                            embedding:          [],
                            embedding_provider: null,
                            embedding_model:    null,
                            content_hash:       null,
                        },
                        $setOnInsert: { last_compiled: null },
                    },
                    upsert: true,
                },
            });
            successCount++;
        } else {
            errorCount++;
        }
    }

    try {
        if (operations.length > 0) {
            await KnowledgeSource.bulkWrite(operations);
        }
        res.json({
            message: `Import selesai! ${successCount} data berhasil diproses.${errorCount > 0 ? ` ${errorCount} data dilewati (tag/content kosong).` : ""} Silakan klik 'Sync/Compile' untuk memperbarui vektor.`,
        });
    } catch (error) {
        console.error("❌ [Import] Error:", error);
        res.status(500).json({ error: "Gagal menyimpan data ke database.", details: error.message });
    }
});

// ── [POST] /api/admin/compile — Sync embedding ke Atlas ───────
router.post("/compile", async (req, res) => {
    try {
        console.log("🛠️ Memulai proses sinkronisasi embedding via Admin...");
        await syncEmbeddingsToAtlas();
        res.json({ message: "✅ Sinkronisasi vektor ke MongoDB Atlas berhasil!" });
    } catch (error) {
        console.error("❌ [Admin Compile] Error:", error);
        res.status(500).json({ error: "Gagal melakukan sinkronisasi.", details: error.message });
    }
});

// ── [GET] /api/admin/chats — Daftar semua sesi chat ───────────
router.get("/chats", async (req, res) => {
    try {
        const sessions = await ChatSession.find({})
            .select("sessionId status createdAt updatedAt")
            .sort({ updatedAt: -1 })
            .limit(200)
            .lean();

        // Map ke format yang diharapkan frontend
        const data = sessions.map(s => ({
            _id:       s._id,
            sessionId: s.sessionId,
            status:    s.status,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
        }));

        res.json({ data });
    } catch (error) {
        console.error("❌ [Admin GET /chats] Error:", error);
        res.status(500).json({ error: "Gagal mengambil daftar chat." });
    }
});

// ── [GET] /api/admin/chats/history — Detail pesan sesi ────────
router.get("/chats/history", async (req, res) => {
    try {
        const { chatId } = req.query;
        if (!chatId) {
            return res.status(400).json({ error: "chatId wajib diisi." });
        }

        const session = await ChatSession.findById(chatId).lean();
        if (!session) {
            return res.status(404).json({ error: "Sesi tidak ditemukan.", data: [] });
        }

        // Kembalikan messages dari terbaru ke terlama (reverse)
        const data = [...(session.messages || [])].reverse();
        res.json({ data });
    } catch (error) {
        console.error("❌ [Admin GET /chats/history] Error:", error);
        res.status(500).json({ error: "Gagal mengambil riwayat chat.", data: [] });
    }
});

// ── [DELETE] /api/admin/chats/delete-old — Hapus chat lama ────
// PENTING: harus di atas /chats/:id agar tidak tertangkap sebagai :id
router.delete("/chats/delete-old", async (req, res) => {
    try {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 hari
        const result = await ChatSession.deleteMany({
            status:    "NONACTIVE",
            updatedAt: { $lt: cutoff },
        });
        res.json({ message: `✅ ${result.deletedCount} chat lama berhasil dihapus.` });
    } catch (error) {
        console.error("❌ [Admin DELETE /chats/delete-old] Error:", error);
        res.status(500).json({ error: "Gagal menghapus chat lama." });
    }
});

// ── [DELETE] /api/admin/chats/:id — Hapus sesi chat ───────────
router.delete("/chats/:id", async (req, res) => {
    try {
        const deleted = await ChatSession.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: "Sesi tidak ditemukan." });
        }
        res.json({ message: "✅ Percakapan berhasil dihapus!" });
    } catch (error) {
        console.error("❌ [Admin DELETE /chats/:id] Error:", error);
        res.status(500).json({ error: "Gagal menghapus percakapan." });
    }
});

export default router;
