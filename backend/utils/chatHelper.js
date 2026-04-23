/**
 * chatHelper.js — v3.1
 *
 * FIXED from v3.0:
 *  - getLLM() is now async (was sync but contained await — crashes at runtime)
 *  - Both processQuestion() and streamQuestion() now await getLLM()
 *
 * Features:
 *  - Primary LLM: Groq API (500+ tok/s, free tier)
 *  - Fallback: Ollama local via dynamic import
 *  - Streaming SSE via streamQuestion()
 *  - Tight prompt — no hallucination, strict scope
 */

import { ChatGroq }           from "@langchain/groq";
import { PromptTemplate }     from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { getVectorStore }     from "./ragHelper.js";

// ── Prompt ───────────────────────────────────────────────────
const QA_TEMPLATE = `Anda adalah asisten virtual resmi Program Studi Magister Ilmu Manajemen (MIM) FEB Universitas Padjadjaran (Unpad).

ATURAN KETAT — WAJIB DIPATUHI:
1. Jawab HANYA pertanyaan yang berkaitan dengan akademik, administrasi, atau informasi Program Studi MIM FEB Unpad.
2. Jika pertanyaan TIDAK terkait MIM FEB Unpad, balas HANYA dengan kalimat ini:
   "Maaf, saya hanya dapat membantu pertanyaan seputar Program Studi MIM FEB Unpad."
3. Jika pertanyaan relevan TETAPI jawaban tidak ada dalam Konteks, balas HANYA dengan:
   "Mohon maaf, informasi tersebut belum tersedia di database kami. Silakan hubungi Helpdesk Akademik FEB Unpad."
4. Jika jawaban ADA dalam Konteks: jawab ringkas, profesional, ramah, Bahasa Indonesia baku.
5. JANGAN tambahkan kalimat penutup seperti "Dengan demikian...", "Jadi...", "Kesimpulannya...".
6. JANGAN mengarang informasi di luar Konteks.

--- KONTEKS ---
{context}

--- PERTANYAAN ---
{question}

--- JAWABAN ---`;

// ── LLM Singleton (async — supports both Groq and Ollama) ────
let _llm = null;

async function getLLM() {
    if (_llm) return _llm;

    const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();

    if (provider === "groq") {
        _llm = new ChatGroq({
            apiKey:      process.env.GROQ_API_KEY,
            model:       process.env.GROQ_MODEL || "llama-3.1-8b-instant",
            temperature: parseFloat(process.env.LLM_TEMPERATURE ?? "0.1"),
            maxTokens:   parseInt(process.env.LLM_MAX_TOKENS   ?? "768", 10),
        });
        console.log(`✅ LLM siap: Groq / ${process.env.GROQ_MODEL || "llama-3.1-8b-instant"}`);
    } else {
        // Fallback: Ollama local — dynamic import is valid in an async function
        const { Ollama } = await import("@langchain/ollama");
        _llm = new Ollama({
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            model:   process.env.LLM_MODEL || "llama3.1",
        });
        console.log(`✅ LLM siap: Ollama / ${process.env.LLM_MODEL || "llama3.1"}`);
    }

    return _llm;
}

// ── Retrieve context from vector store ───────────────────────
async function retrieveContext(question) {
    const vectorStore = await getVectorStore();
    if (!vectorStore) return null;

    const k    = parseInt(process.env.RAG_TOP_K ?? "8", 10);
    const docs  = await vectorStore.similaritySearch(question, k);
    if (!docs.length) return "";
    return docs.map(d => d.pageContent).join("\n\n---\n\n");
}

// ── Build formatted prompt string ────────────────────────────
async function buildPromptString(question, context) {
    const template = PromptTemplate.fromTemplate(QA_TEMPLATE);
    return template.format({ context, question });
}

// ── Strip common trailing artifacts from LLM output ──────────
function cleanAnswer(raw) {
    return raw
        .replace(/\n*(Dengan demikian|Jadi,|Kesimpulannya|Demikian,|Semoga membantu)[^]*$/si, "")
        .replace(/^(Jawaban:|Asisten:)\s*/i, "")
        .trim();
}

// ─────────────────────────────────────────────────────────────
// processQuestion — returns full string (used by non-streaming proxy)
// ─────────────────────────────────────────────────────────────
export async function processQuestion(question) {
    const context = await retrieveContext(question);

    if (context === null) {
        return "Sistem database sedang tidak tersedia. Silakan coba beberapa saat lagi.";
    }

    const promptText = await buildPromptString(question, context);
    const llm        = await getLLM();   // ← await (async)
    const response   = await llm.invoke(promptText);
    const raw        = typeof response === "string" ? response : (response.content ?? "");
    return cleanAnswer(raw);
}

// ─────────────────────────────────────────────────────────────
// streamQuestion — SSE token stream directly into res
// Caller must set SSE headers before calling this.
// ─────────────────────────────────────────────────────────────
export async function streamQuestion(question, res) {
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const context = await retrieveContext(question);

        if (context === null) {
            send({ error: "Sistem database tidak tersedia." });
            return res.end();
        }

        const promptText = await buildPromptString(question, context);
        const llm        = await getLLM();   // ← await (async)

        const stream = await llm.stream(promptText);
        let buffer = "";

        for await (const chunk of stream) {
            const token = chunk.content ?? "";
            if (!token) continue;

            buffer += token;

            // Early-exit if trailing-phrase starts appearing
            if (/\n*(Dengan demikian|Jadi,|Kesimpulannya|Demikian,)/i.test(buffer)) break;

            send({ token });
        }

        send({ done: true });
        res.end();

    } catch (err) {
        console.error("❌ [streamQuestion] Error:", err.message);
        try { res.write(`data: ${JSON.stringify({ error: "Terjadi kesalahan saat memproses jawaban." })}\n\n`); } catch {}
        res.end();
    }
}
