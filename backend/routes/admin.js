import express from "express";
import { protect, isAdmin } from "../middleware/authMiddleware.js";
import KnowledgeSource from "../models/KnowledgeSource.js";
import { syncEmbeddingsToAtlas } from "../utils/ragHelper.js";

import multer from "multer";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Batas 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/json" || file.originalname.endsWith(".json")) {
            cb(null, true);
        } else {
            cb(new Error("Hanya file JSON yang diizinkan."));
        }
    },
});

router.use(protect);
router.use(isAdmin);

// --- [POST] Import Data dari JSON ---
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
    let errorCount = 0;
    const operations = [];

    for (const item of data) {
        if (item.tag && item.content_text) {
            operations.push({
                updateOne: {
                    filter: { tag: item.tag },
                    update: {
                        $set: { content_text: item.content_text, embedding: [] }, // Reset embedding agar di-sync ulang
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

// [GET] /data
router.get("/data", async (req, res) => {
    try {
        const data = await KnowledgeSource.find({}).lean().sort({ tag: 1 });
        res.json(data);
    } catch (error) {
        console.error("❌ [Admin GET /data] Error:", error);
        res.status(500).json({ error: "Gagal mengambil data dari MongoDB Atlas." });
    }
});

// [POST] /data
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

// [PUT] /data/:id
router.put("/data/:id", async (req, res) => {
    try {
        const update = { ...req.body };

        // Reset embedding jika content berubah agar di-embed ulang
        if (update.content_text) {
            update.embedding = [];
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

// [DELETE] /data/:id
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

// [POST] /compile — Sync embedding ke Atlas
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

export default router;