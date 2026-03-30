import express from "express";
import { protect, isAdmin } from "../middleware/authMiddleware.js";
import KnowledgeSource from "../models/KnowledgeSource.js";
// Ganti import fungsi lama dengan yang baru
import { syncEmbeddingsToAtlas } from "../utils/ragHelper.js";

// 1. IMPORT MULTER UNTUK FILE UPLOAD
import multer from "multer";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Pasang penjaga akses
router.use(protect);
router.use(isAdmin);

// --- [POST] Import Data dari JSON ---
router.post("/import", upload.single('importFile'), async (req, res) => {  
    if (!req.file) {
        return res.status(400).json({ error: "Tidak ada file yang di-upload." });
    }

    let data;
    try {
        // Ubah buffer file (teks mentah) menjadi string JSON
        const jsonString = req.file.buffer.toString('utf-8');
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

    // Loop data dan siapkan operasi database
    for (const item of data) {
        if (item.tag && item.content_text) {
            operations.push({
                updateOne: {
                    filter: { tag: item.tag },
                    // Kita set embedding ke empty array agar nanti diproses oleh syncEmbeddingsToAtlas
                    update: { 
                        $set: { content_text: item.content_text },
                        $setOnInsert: { embedding: [] } 
                    },
                    upsert: true
                }
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
            message: `Import selesai! ${successCount} data berhasil diproses ke DB. Silakan klik 'Sync/Compile' untuk memperbarui vektor.` 
        });
    } catch (error) {
        res.status(500).json({ error: "Gagal menyimpan data ke database.", details: error.message });
    }
});


// [GET] /data
router.get("/data", async (req, res) => {
  try {
    const data = await KnowledgeSource.find({});
    res.json(data.sort((a, b) => a.tag.localeCompare(b.tag))); 
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Gagal mengambil data dari MongoDB Atlas." });
  }
});

// [POST] /data
router.post("/data", async (req, res) => {
  try {
    // Pastikan data baru memiliki field embedding kosong agar nanti bisa di-sync
    const newData = new KnowledgeSource({
        ...req.body,
        embedding: []
    });
    await newData.save();
    res.status(201).json(newData);
  } catch (error) {
    console.error("Error saving data:", error);
    if (error.code === 11000)
      return res.status(400).json({ error: "Tag data sudah ada di database." });
    res.status(400).json({ error: "Gagal menyimpan data.", details: error.message });
  }
});

// [PUT] /data/:id
router.put("/data/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    
    // Jika content_text diubah, kita kosongkan embedding agar di-sync ulang
    if (update.content_text) {
        update.embedding = [];
    }

    const updatedData = await KnowledgeSource.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!updatedData) {
      return res.status(404).json({ error: "Data tidak ditemukan." });
    }
    res.json(updatedData);
  } catch (error) {
    console.error("❌ Error updating data:", error);
    if (error.code === 11000)
      return res.status(400).json({ error: "Tag data sudah ada di database." });
    res.status(400).json({ error: "Gagal memperbarui data.", details: error.message });
  }
});

// [DELETE] /data/:id
router.delete("/data/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedData = await KnowledgeSource.findByIdAndDelete(id);
    if (!deletedData) {
      return res.status(404).json({ error: "Data tidak ditemukan." });
    }
    res.json({ message: "✅ Data berhasil dihapus!", deletedId: id });
  } catch (error) {
    console.error("Error deleting data:", error);
    res.status(500).json({ error: "Gagal menghapus data.", details: error.message });
  }
});

// [POST] /compile -> Sekarang berfungsi sebagai SYNC ke Atlas
router.post("/compile", async (req, res) => {
  try {
    console.log("🛠️ Memulai proses sinkronisasi embedding via Admin...");
    await syncEmbeddingsToAtlas();
    res.json({ message: "✅ Sinkronisasi vektor ke MongoDB Atlas berhasil!" });
  } catch (error) {
    console.error("❌ Sync Error (dari admin route):", error);
    res.status(500).json({ error: "Gagal melakukan sinkronisasi data ke Atlas.", details: error.message });
  }
});

export default router;