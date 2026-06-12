import express from "express";
import { protect }                          from "../middleware/authMiddleware.js";
import { processQuestion, streamQuestion }  from "../utils/chatHelper.js";

const router = express.Router();
router.use(protect);

// ── POST /api/chat — full response (non-streaming) ────────────
router.post("/", async (req, res) => {
    try {
        const { question } = req.body;

        if (!question || typeof question !== "string" || !question.trim()) {
            return res.status(400).json({ error: "Pertanyaan tidak boleh kosong." });
        }

        const answer = await processQuestion(question.trim());
        res.json({ answer });

    } catch (err) {
        console.error("❌ [Chat] Error:", err);
        res.status(500).json({ error: "Terjadi kesalahan sistem." });
    }
});

// ── POST /api/chat/stream — SSE streaming (authenticated) ─────
router.post("/stream", async (req, res) => {
    const { question } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ error: "Pertanyaan tidak boleh kosong." });
    }

    res.setHeader("Content-Type",      "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control",     "no-cache, no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection",        "keep-alive");
    res.flushHeaders();

    await streamQuestion(question.trim(), res);
});

export default router;
