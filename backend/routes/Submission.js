import express from "express";
import Submission from "../models/Submission.js";
import KnowledgeSource from "../models/KnowledgeSource.js";
import { protect, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// --- Rute untuk USER ---

// [POST] /api/submission
router.post("/", protect, async (req, res) => {
    try {
        const { tag, content_text } = req.body;

        if (!tag || !content_text) {
            return res.status(400).json({ error: "Tag dan content_text wajib diisi." });
        }

        const newSubmission = new Submission({
            tag: tag.trim(),
            content_text: content_text.trim(),
            submittedBy: req.user._id,
        });

        const saved = await newSubmission.save();
        res.status(201).json(saved);
    } catch (error) {
        console.error("❌ [Submission POST] Error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "Tag sudah pernah diajukan." });
        }
        res.status(400).json({ error: "Gagal mengirim data.", details: error.message });
    }
});

// [GET] /api/submission/mine
router.get("/mine", protect, async (req, res) => {
    try {
        const mySubmissions = await Submission.find({ submittedBy: req.user._id })
            .sort({ createdAt: -1 });
        res.json(mySubmissions);
    } catch (error) {
        console.error("❌ [Submission GET mine] Error:", error);
        res.status(500).json({ error: "Gagal mengambil data." });
    }
});

// --- Rute untuk ADMIN ---

// [GET] /api/submission/all
router.get("/all", protect, isAdmin, async (req, res) => {
    try {
        const allSubmissions = await Submission.find({})
            .populate("submittedBy", "email")
            .sort({ createdAt: -1 });
        res.json(allSubmissions);
    } catch (error) {
        console.error("❌ [Submission GET all] Error:", error);
        res.status(500).json({ error: "Gagal mengambil data." });
    }
});

// [PUT] /api/submission/:id — Admin approve/reject
router.put("/:id", protect, isAdmin, async (req, res) => {
    try {
        const { status, notes } = req.body;

        if (!["pending", "accepted", "rejected"].includes(status)) {
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

        if (status === "accepted") {
            console.log(`✅ Status 'accepted'. Menyalin '${updatedSubmission.tag}' ke KnowledgeSource...`);

            // FIX: Reset embedding ke [] agar otomatis di-sync ulang oleh syncEmbeddingsToAtlas
            await KnowledgeSource.findOneAndUpdate(
                { tag: updatedSubmission.tag },
                {
                    content_text: updatedSubmission.content_text,
                    embedding: [], // Wajib dikosongkan agar nanti di-embed ulang
                },
                { upsert: true, runValidators: true }
            );

            console.log(`✔ '${updatedSubmission.tag}' berhasil di-upsert ke KnowledgeSource.`);
        }

        res.json(updatedSubmission);

    } catch (error) {
        console.error("❌ [Submission PUT] Error:", error);
        res.status(500).json({ error: "Gagal memperbarui status.", details: error.message });
    }
});

export default router;
