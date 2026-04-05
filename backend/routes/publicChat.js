import express from "express";
import { processQuestion } from "../utils/chatHelper.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { question } = req.body;

        if (!question || typeof question !== "string" || question.trim() === "") {
            return res.status(400).json({ error: "Pertanyaan tidak boleh kosong." });
        }

        const answer = await processQuestion(question.trim());
        res.json({ answer });

    } catch (err) {
        console.error("❌ [PublicChat] Error:", err);
        res.status(500).json({ error: "Terjadi kesalahan internal saat memproses jawaban." });
    }
});

export default router;
