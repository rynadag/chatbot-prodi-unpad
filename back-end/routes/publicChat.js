import express      from "express";
import { v4 as uuidv4 } from "uuid";
import { processQuestion, streamQuestion } from "../utils/chatHelper.js";
import ChatSession  from "../models/ChatSession.js";

const router = express.Router();

// ── Helper: ambil/buat sesi dari sessionId di header ────────
async function getOrCreateSession(sessionId) {
    if (sessionId) {
        try {
            const existing = await ChatSession.findOne({ sessionId });
            if (existing) return { session: existing, sessionId };
        } catch { /* fallback ke baru */ }
    }
    const newId  = sessionId || uuidv4();
    const session = new ChatSession({ sessionId: newId, status: "ACTIVE", messages: [] });
    await session.save();
    return { session, sessionId: newId };
}

// ── POST /api/public-chat — full response (non-streaming) ────
router.post("/", async (req, res) => {
    try {
        const { question } = req.body;
        if (!question || typeof question !== "string" || !question.trim()) {
            return res.status(400).json({ error: "Pertanyaan tidak boleh kosong." });
        }

        const incomingSessionId = req.headers["x-session-id"] || null;
        const { session, sessionId } = await getOrCreateSession(incomingSessionId);
        const trimmed = question.trim();

        // Simpan pesan user
        session.messages.push({ sender: "USER", msg: trimmed });

        const answer = await processQuestion(trimmed);

        // Simpan jawaban bot
        session.messages.push({ sender: "BOT", msg: answer });
        await session.save();

        res.json({ answer, sessionId });
    } catch (err) {
        console.error("❌ [PublicChat] Error:", err);
        res.status(500).json({ error: "Terjadi kesalahan internal." });
    }
});

// ── POST /api/public-chat/stream — SSE streaming (publik) ────
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

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const trimmed = question.trim();

    // Ambil/buat sesi & simpan pesan user
    let session   = null;
    let sessionId = null;

    try {
        const incomingSessionId = req.headers["x-session-id"] || null;
        const result = await getOrCreateSession(incomingSessionId);
        session   = result.session;
        sessionId = result.sessionId;

        session.messages.push({ sender: "USER", msg: trimmed });
        await session.save();

        // Kirim sessionId ke client
        send({ sessionId });
    } catch (err) {
        console.error("⚠️ [PublicChat/stream] Session error:", err.message);
        // Tetap lanjut stream meski session gagal
    }

    // Stream jawaban dan kumpulkan token
    const tokens = [];

    // Bungkus res.write sementara untuk intercept tokens
    const origWrite = res.write.bind(res);
    res.write = (chunk) => {
        try {
            const raw   = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
            const lines = raw.split("\n");
            for (const line of lines) {
                const trimLine = line.trim();
                if (!trimLine.startsWith("data:")) continue;
                const json = trimLine.slice(5).trim();
                if (!json) continue;
                const parsed = JSON.parse(json);
                if (parsed.token) tokens.push(parsed.token);
            }
        } catch { /* ignore */ }
        return origWrite(chunk);
    };

    const origEnd = res.end.bind(res);
    res.end = async (...args) => {
        // Restore
        res.write = origWrite;
        res.end   = origEnd;

        // Simpan jawaban bot
        if (session && tokens.length > 0) {
            try {
                const fullAnswer = tokens.join("");
                session.messages.push({ sender: "BOT", msg: fullAnswer });
                await session.save();
            } catch (err) {
                console.error("⚠️ Gagal simpan jawaban bot:", err.message);
            }
        }
        return origEnd(...args);
    };

    await streamQuestion(trimmed, res);
});

export default router;
