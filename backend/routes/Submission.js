import express from "express";
import Submission from "../models/Submission.js";
import KnowledgeSource from "../models/KnowledgeSource.js"; // <-- 1. IMPORT MODEL KNOWLEDGE SOURCE
import { protect, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// --- Rute untuk USER ---

// [POST] /api/submission
// User mengirimkan data baru (status otomatis 'pending')
router.post("/", protect, async (req, res) => {
  try {
    const { tag, content_text } = req.body;

    const newSubmission = new Submission({
      tag,
      content_text,
      submittedBy: req.user._id 
    });

    const savedSubmission = await newSubmission.save();
    res.status(201).json(savedSubmission);
  } catch (error) {
    res.status(400).json({ error: "Gagal mengirim data.", details: error.message });
  }
});

// [GET] /api/submission/mine
// User melihat histori/status data yang pernah dia kirim
router.get("/mine", protect, async (req, res) => {
  try {
    const mySubmissions = await Submission.find({ submittedBy: req.user._id })
      .sort({ createdAt: -1 }); 
    res.json(mySubmissions);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data." });
  }
});

// --- Rute untuk ADMIN ---

// [GET] /api/submission/all
// Admin melihat semua data yang dikirim oleh SEMUA user
router.get("/all", protect, isAdmin, async (req, res) => {
  try {
    const allSubmissions = await Submission.find({})
      .populate('submittedBy', 'email') 
      .sort({ createdAt: -1 });
    res.json(allSubmissions);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data." });
  }
});

// [PUT] /api/submission/:id
// Admin mengubah status (approve/reject) sebuah data
router.put("/:id", protect, isAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body; 

    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid." });
    }

    const updatedSubmission = await Submission.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true, runValidators: true } 
    );

    if (!updatedSubmission) {
      return res.status(404).json({ error: "Data submission tidak ditemukan." });
    }

    if (status === 'accepted') {
      console.log(`Status 'accepted'. Menyalin data '${updatedSubmission.tag}' ke KnowledgeSource...`);

      // Gunakan 'findOneAndUpdate' dengan 'upsert: true'.
      // Ini akan (UP)date jika 'tag' ada, atau (IN)sert jika 'tag' tidak ada.
      await KnowledgeSource.findOneAndUpdate(
        { tag: updatedSubmission.tag }, // Kriteria pencarian
        { content_text: updatedSubmission.content_text }, // Data yang di-update/dibuat
        {
          upsert: true, // <-- Ini kuncinya!
          runValidators: true
        }
      );
      
      console.log(`Data '${updatedSubmission.tag}' berhasil di-upsert ke KnowledgeSource.`);
    }

    res.json(updatedSubmission);
    
  } catch (error) {
    console.error("Error di [PUT] /api/submission/:id :", error);
    res.status(500).json({ error: "Gagal memperbarui status.", details: error.message });
  }
});

export default router;