/**
 * chatHelper.js
 *
 * Chat orchestration for MIM FEB Unpad:
 *  - Groq primary LLM, Ollama fallback
 *  - Hybrid RAG: vector retrieval + keyword fallback + chunk reranking
 *  - Natural Indonesian prompt with strict grounding to retrieved context
 *  - Streaming SSE via streamQuestion()
 */

import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import mongoose from "mongoose";
import KnowledgeSource from "../models/KnowledgeSource.js";
import { getVectorStore } from "./ragHelper.js";

// ── Prompt ───────────────────────────────────────────────────
const QA_TEMPLATE = `Anda adalah asisten virtual resmi Program Studi Magister Ilmu Manajemen (MIM) FEB Universitas Padjadjaran (Unpad).

Tugas utama Anda adalah membantu pertanyaan seputar MIM FEB Unpad, termasuk akademik, kurikulum, tesis, administrasi, fasilitas, pendaftaran, pimpinan, dan informasi FEB/Unpad yang masih relevan dengan prodi.

GAYA JAWABAN:
- Gunakan Bahasa Indonesia yang natural, ramah, dan profesional. Tidak perlu kaku atau terlalu formal.
- Jawab langsung inti pertanyaan. Gunakan poin-poin jika jawabannya berisi daftar, syarat, atau langkah.
- Boleh menambahkan kalimat pendek yang membantu alur, tetapi jangan bertele-tele.
- Jangan menyebut "berdasarkan konteks" kecuali memang perlu untuk menjelaskan keterbatasan data.
- Jangan menulis bagian "Sumber"; sistem akan menambahkannya otomatis setelah jawaban.

BATASAN WAJIB:
- Gunakan hanya informasi dari KONTEKS untuk fakta spesifik seperti nama, tanggal, biaya, syarat, jadwal, SKS, nilai, lokasi, dan prosedur.
- Jika pertanyaan relevan tetapi informasinya tidak ada atau tidak cukup jelas di KONTEKS, jawab dengan jujur bahwa data tersebut belum tersedia di database, lalu arahkan pengguna menghubungi Helpdesk Akademik FEB Unpad.
- Jika pertanyaan jelas di luar MIM FEB Unpad/FEB/Unpad, jawab singkat dan ramah bahwa Anda hanya bisa membantu seputar MIM FEB Unpad.
- Jika KONTEKS berisi beberapa potongan yang mirip, prioritaskan informasi yang paling spesifik untuk MIM.
- Jangan mengarang, menebak, atau memakai pengetahuan luar.

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
            apiKey: process.env.GROQ_API_KEY,
            model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
            temperature: parseFloat(process.env.LLM_TEMPERATURE ?? "0.2"),
            maxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? "768", 10),
        });
        console.log(`✅ LLM siap: Groq / ${process.env.GROQ_MODEL || "llama-3.1-8b-instant"}`);
    } else {
        const { Ollama } = await import("@langchain/ollama");
        _llm = new Ollama({
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            model: process.env.LLM_MODEL || "llama3.1",
        });
        console.log(`✅ LLM siap: Ollama / ${process.env.LLM_MODEL || "llama3.1"}`);
    }

    return _llm;
}

const QUERY_EXPANSIONS = [
    {
        keywords: ["kepala prodi", "kaprodi", "ka prodi", "ketua prodi", "ketua program studi", "pimpinan prodi", "kepala program studi"],
        expand: ["ketua program studi", "kepala program studi", "pimpinan prodi", "MIM"],
    },
    {
        keywords: ["sekprodi", "sekretaris prodi", "sekretaris program studi"],
        expand: ["sekretaris program studi", "sekretaris prodi", "MIM"],
    },
    {
        keywords: ["biaya", "ukt", "spp", "bayar", "pembayaran", "biaya kuliah"],
        expand: ["biaya kuliah", "UKT", "SPP", "pembayaran semester"],
    },
    {
        keywords: ["daftar", "pendaftaran", "registrasi", "admisi", "pmb", "masuk"],
        expand: ["pendaftaran", "registrasi", "penerimaan mahasiswa baru", "PMB", "admisi"],
    },
    {
        keywords: ["kurikulum", "sks", "mata kuliah", "matkul", "semester"],
        expand: ["kurikulum", "struktur kurikulum", "mata kuliah", "SKS", "semester"],
    },
    {
        keywords: ["tesis", "sur", "seminar usulan riset", "ujian tesis", "publikasi", "artikel ilmiah"],
        expand: ["tesis", "Seminar Usulan Riset", "SUR", "Ujian Tesis", "artikel ilmiah", "publikasi"],
    },
    {
        keywords: ["nilai", "ipk", "ips", "kelulusan", "yudisium", "cumlaude", "pujian"],
        expand: ["penilaian", "IPK", "IPS", "kelulusan", "yudisium", "Pujian"],
    },
    {
        keywords: ["kampus", "alamat", "lokasi", "fasilitas", "perpustakaan", "ruang kuliah"],
        expand: ["lokasi kampus", "fasilitas", "perpustakaan", "ruang kuliah", "Dipati Ukur", "Jatinangor"],
    },
    {
        keywords: ["konsentrasi", "peminatan", "pemasaran", "keuangan", "sdm", "sumber daya manusia", "operasi", "kewirausahaan"],
        expand: ["konsentrasi", "peminatan", "pemasaran", "keuangan", "manajemen sumber daya manusia", "manajemen operasi", "kewirausahaan"],
    },
    {
        keywords: ["visi", "misi", "tujuan", "tagline"],
        expand: ["visi", "misi", "tujuan", "tagline", "Leading and Inspiring"],
    },
    {
        keywords: ["profil lulusan", "lulusan", "kompetensi", "capaian pembelajaran"],
        expand: ["profil lulusan", "kompetensi lulusan", "capaian pembelajaran"],
    },
    {
        keywords: ["cuti", "herregistrasi", "registrasi ulang", "drop out", "do", "pemutusan studi", "sanksi"],
        expand: ["herregistrasi", "registrasi ulang", "pemutusan studi", "sanksi akademik", "peringatan akademik"],
    },
];

const STOPWORDS = new Set([
    "ada", "adalah", "agar", "akan", "aku", "anda", "apa", "apakah", "atau", "bagaimana",
    "bagi", "bisa", "buat", "dalam", "dan", "dapat", "dari", "dengan", "di", "dimana",
    "dong", "itu", "jadi", "jika", "kan", "ke", "kok", "lagi", "lah", "mau", "mohon",
    "oleh", "pada", "paling", "para", "saja", "saya", "sebagai", "sebutkan", "secara",
    "seputar", "siapa", "sih", "tentang", "terkait", "tersebut", "tidak", "tolong", "untuk",
    "yang",
]);

const SHORT_TOKEN_ALLOWLIST = new Set(["do", "ip", "ipk", "ips", "mim", "pmb", "s2", "sks", "sur", "ut"]);

function parsePositiveInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getRagConfig() {
    const contextChunks = parsePositiveInt(process.env.RAG_CONTEXT_CHUNKS ?? process.env.RAG_TOP_K, 4);

    return {
        fetchK: parsePositiveInt(process.env.RAG_FETCH_K ?? process.env.RAG_CANDIDATE_K, Math.max(10, contextChunks * 3)),
        keywordLimit: parsePositiveInt(process.env.RAG_KEYWORD_LIMIT, 12),
        contextChunks,
        maxChunkChars: parsePositiveInt(process.env.RAG_CHUNK_CHARS, 760),
        chunkOverlap: parsePositiveInt(process.env.RAG_CHUNK_OVERLAP, 80),
        maxContextChars: parsePositiveInt(process.env.RAG_MAX_CONTEXT_CHARS, 3600),
        minVectorScore: parseNumber(process.env.RAG_MIN_VECTOR_SCORE, 0.62),
        minChunkScore: parseNumber(process.env.RAG_MIN_CHUNK_SCORE, 0.12),
        sourceLimit: parsePositiveInt(process.env.RAG_SOURCE_LIMIT, 3),
    };
}

function normalizeText(input) {
    return String(input ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function unique(items) {
    return [...new Set(items.filter(Boolean))];
}

function tokenize(text) {
    return unique(
        normalizeText(text)
            .split(/\s+/)
            .filter(token =>
                token &&
                !STOPWORDS.has(token) &&
                (token.length >= 3 || SHORT_TOKEN_ALLOWLIST.has(token))
            )
    );
}

function includesKeyword(text, keyword) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) return false;

    if (normalizedKeyword.length <= 2) {
        return text.split(/\s+/).includes(normalizedKeyword);
    }

    return text.includes(normalizedKeyword);
}

function getMatchedExpansions(normalizedQuestion) {
    const expansions = [];

    for (const item of QUERY_EXPANSIONS) {
        if (item.keywords.some(keyword => includesKeyword(normalizedQuestion, keyword))) {
            expansions.push(...item.expand);
        }
    }

    return unique(expansions);
}

function expandQuery(question) {
    const normalizedQuestion = normalizeText(question);
    const expansions = getMatchedExpansions(normalizedQuestion);

    if (!expansions.length) return question;
    return `${question} ${expansions.join(" ")}`;
}

function createSearchProfile(question) {
    const normalizedQuestion = normalizeText(question);
    const expansions = getMatchedExpansions(normalizedQuestion);
    const expandedQuery = expandQuery(question);
    const tokens = tokenize(expandedQuery).slice(0, 24);
    const phrases = unique([
        ...expansions.map(normalizeText),
        ...QUERY_EXPANSIONS.flatMap(item =>
            item.keywords
                .filter(keyword => includesKeyword(normalizedQuestion, keyword))
                .map(normalizeText)
        ),
    ]).filter(phrase => phrase.length >= 3);

    return {
        original: question,
        normalizedQuestion,
        expandedQuery,
        tokens,
        phrases,
    };
}

function getDirectAnswer(question) {
    const q = normalizeText(question);

    if (/^(halo|hai|hi|hello|assalamualaikum|assalamu alaikum|permisi|selamat pagi|selamat siang|selamat sore|selamat malam)(\s+(admin|min|kak|bot))?$/.test(q)) {
        return "Halo! Saya asisten virtual MIM FEB Unpad. Silakan tanya seputar akademik, administrasi, kurikulum, tesis, pendaftaran, atau informasi prodi.";
    }

    if (/^(terima kasih|makasih|thanks|thank you|thx)(\s+(banyak|ya|admin|min|kak|bot))*$/.test(q)) {
        return "Sama-sama. Kalau ada pertanyaan lain seputar MIM FEB Unpad, silakan tanya.";
    }

    if (/^(apa kabar|gimana kabarnya|bagaimana kabarnya)$/.test(q)) {
        return "Baik, terima kasih. Saya siap membantu pertanyaan seputar MIM FEB Unpad.";
    }

    if (/^(siapa kamu|kamu siapa|anda siapa|ini bot apa|ini chatbot apa|apa ini)$/.test(q)) {
        return "Saya asisten virtual Program Studi Magister Ilmu Manajemen FEB Unpad. Saya membantu menjawab informasi prodi berdasarkan data yang tersedia.";
    }

    return null;
}

function cleanContent(text) {
    return String(text ?? "")
        .replace(/\[cite:\s*\d+\]/gi, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
}

function hardSplit(text, maxChars, overlap) {
    const chunks = [];
    let start = 0;
    const stepBack = Math.min(overlap, Math.floor(maxChars / 3));

    while (start < text.length) {
        let end = Math.min(start + maxChars, text.length);

        if (end < text.length) {
            const pivot = text.lastIndexOf(" ", end);
            if (pivot > start + Math.floor(maxChars * 0.65)) {
                end = pivot;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk) chunks.push(chunk);
        if (end >= text.length) break;

        start = Math.max(end - stepBack, start + 1);
    }

    return chunks;
}

function splitIntoChunks(text, config) {
    const clean = cleanContent(text);
    if (!clean) return [];

    const qaParts = clean
        .split(/(?=\bTanya\s*:)/i)
        .map(part => part.trim())
        .filter(Boolean);

    if (qaParts.length > 1) {
        return qaParts.flatMap(part =>
            part.length > config.maxChunkChars
                ? hardSplit(part, config.maxChunkChars, config.chunkOverlap)
                : [part]
        );
    }

    if (clean.length <= config.maxChunkChars) {
        return [clean];
    }

    const sentences = clean
        .split(/(?<=[.!?])\s+|(?=\b\d+\.\s+)/g)
        .map(sentence => sentence.trim())
        .filter(Boolean);

    if (sentences.length <= 1) {
        return hardSplit(clean, config.maxChunkChars, config.chunkOverlap);
    }

    const chunks = [];
    let buffer = "";

    for (const sentence of sentences) {
        const candidate = buffer ? `${buffer} ${sentence}` : sentence;
        if (candidate.length > config.maxChunkChars && buffer) {
            chunks.push(buffer);
            buffer = sentence;
        } else {
            buffer = candidate;
        }

        if (buffer.length > config.maxChunkChars) {
            chunks.push(...hardSplit(buffer, config.maxChunkChars, config.chunkOverlap));
            buffer = "";
        }
    }

    if (buffer) chunks.push(buffer);
    return chunks;
}

function scoreTextAgainstProfile(text, profile) {
    const normalized = normalizeText(text);
    let score = 0;

    for (const phrase of profile.phrases) {
        if (normalized.includes(phrase)) score += 3;
    }

    for (const token of profile.tokens) {
        if (normalized.includes(token)) score += SHORT_TOKEN_ALLOWLIST.has(token) ? 0.7 : 1;
    }

    if (profile.normalizedQuestion.length > 8 && normalized.includes(profile.normalizedQuestion)) {
        score += 4;
    }

    const tagPart = normalizeText(String(text).split(" ", 1)[0] || "");
    if (tagPart && profile.tokens.some(token => tagPart.includes(token))) {
        score += 1.5;
    }

    return score;
}

async function vectorSearch(profile, config) {
    const vectorStore = await getVectorStore();
    if (!vectorStore) return { ok: false, matches: [] };

    try {
        const docs = await vectorStore.similaritySearchWithScore(profile.expandedQuery, config.fetchK);

        return {
            ok: true,
            matches: docs.map(([doc, score], index) => ({
                id: String(doc.metadata?._id ?? doc.metadata?.id ?? doc.metadata?.tag ?? `vector-${index}`),
                tag: doc.metadata?.tag || "tanpa_tag",
                content: doc.pageContent || "",
                vectorScore: Number(score) || 0,
                keywordDocScore: 0,
                source: "vector",
            })),
        };
    } catch (err) {
        console.error("❌ Vector search gagal, lanjut keyword fallback:", err.message);
        return { ok: false, matches: [] };
    }
}

async function keywordSearch(profile, config) {
    if (mongoose.connection.readyState !== 1) {
        return { ok: false, matches: [] };
    }

    const terms = unique([...profile.phrases, ...profile.tokens])
        .map(term => normalizeText(term).slice(0, 60))
        .filter(term => term.length >= 3 || SHORT_TOKEN_ALLOWLIST.has(term))
        .slice(0, 14);

    if (!terms.length) return { ok: true, matches: [] };

    try {
        const searchableTag = { $toLower: { $ifNull: ["$tag", ""] } };
        const searchableContent = { $toLower: { $ifNull: ["$content_text", ""] } };
        const termMatches = terms.flatMap(term => ([
            { $gte: [{ $indexOfCP: [searchableTag, term] }, 0] },
            { $gte: [{ $indexOfCP: [searchableContent, term] }, 0] },
        ]));

        const docs = await KnowledgeSource.aggregate([
            { $match: { $expr: { $or: termMatches } } },
            { $project: { tag: 1, content_text: 1 } },
            { $limit: config.keywordLimit * 3 },
        ]);

        return {
            ok: true,
            matches: docs.map(doc => ({
                id: String(doc._id),
                tag: doc.tag || "tanpa_tag",
                content: doc.content_text || "",
                vectorScore: 0,
                keywordDocScore: scoreTextAgainstProfile(`${doc.tag} ${doc.content_text}`, profile),
                source: "keyword",
            }))
                .sort((a, b) => b.keywordDocScore - a.keywordDocScore)
                .slice(0, config.keywordLimit),
        };
    } catch (err) {
        console.error("❌ Keyword search gagal:", err.message);
        return { ok: false, matches: [] };
    }
}

function mergeMatches(groups) {
    const byId = new Map();

    for (const match of groups.flat()) {
        if (!match.content) continue;

        const key = match.id || match.tag || cleanContent(match.content).slice(0, 80);
        const existing = byId.get(key);

        if (!existing) {
            byId.set(key, { ...match, sources: new Set([match.source]) });
            continue;
        }

        existing.vectorScore = Math.max(existing.vectorScore || 0, match.vectorScore || 0);
        existing.keywordDocScore = Math.max(existing.keywordDocScore || 0, match.keywordDocScore || 0);
        existing.content = existing.content.length >= match.content.length ? existing.content : match.content;
        existing.sources.add(match.source);
    }

    return [...byId.values()];
}

function scoreChunk(chunk, profile, config) {
    const text = `${chunk.tag} ${chunk.content}`;
    const lexicalScore = scoreTextAgainstProfile(text, profile);
    const tokenScore = profile.tokens.length
        ? Math.min(lexicalScore / Math.max(profile.tokens.length, 1), 1)
        : 0;
    const vectorBoost = clamp(((chunk.vectorScore || 0) - config.minVectorScore) * 0.7, 0, 0.28);
    const keywordBoost = clamp((chunk.keywordDocScore || 0) * 0.025, 0, 0.24);

    return tokenScore * 0.58 + vectorBoost + keywordBoost;
}

function selectContextChunks(matches, profile, config) {
    const scored = [];

    for (const match of matches) {
        const chunks = splitIntoChunks(match.content, config);

        chunks.forEach((content, chunkIndex) => {
            const chunk = {
                ...match,
                content,
                chunkIndex,
            };

            scored.push({
                ...chunk,
                relevance: scoreChunk(chunk, profile, config),
            });
        });
    }

    const filtered = scored
        .filter(chunk =>
            chunk.relevance >= config.minChunkScore ||
            (chunk.vectorScore || 0) >= config.minVectorScore ||
            (chunk.keywordDocScore || 0) >= 2
        )
        .sort((a, b) => {
            if (b.relevance !== a.relevance) return b.relevance - a.relevance;
            return (b.vectorScore || 0) - (a.vectorScore || 0);
        });

    const selected = [];
    const fingerprints = new Set();
    let totalChars = 0;

    for (const chunk of filtered) {
        const fingerprint = normalizeText(chunk.content).slice(0, 180);
        if (!fingerprint || fingerprints.has(fingerprint)) continue;

        const nextTotal = totalChars + chunk.content.length;
        if (selected.length && nextTotal > config.maxContextChars) continue;

        selected.push(chunk);
        fingerprints.add(fingerprint);
        totalChars = nextTotal;

        if (selected.length >= config.contextChunks) break;
    }

    return selected;
}

function getChunkSource(chunk) {
    return {
        tag: chunk.tag || "tanpa_tag",
        id: chunk.id || null,
        score: Number.isFinite(chunk.relevance) ? Number(chunk.relevance.toFixed(3)) : null,
    };
}

function formatSourceLabel(source) {
    return source.tag;
}

function uniqueSources(chunks, limit) {
    const sources = [];
    const seen = new Set();

    for (const chunk of chunks) {
        const source = getChunkSource(chunk);
        const key = source.tag || source.id;
        if (!key || seen.has(key)) continue;

        sources.push(source);
        seen.add(key);

        if (sources.length >= limit) break;
    }

    return sources;
}

function formatContext(chunks) {
    if (!chunks.length) {
        return "Tidak ada konteks relevan yang ditemukan di database.";
    }

    return chunks
        .map((chunk, index) => `[${index + 1}] Sumber: ${chunk.tag}\n${chunk.content}`)
        .join("\n\n---\n\n");
}

async function retrieveContext(question) {
    const config = getRagConfig();
    const profile = createSearchProfile(question);

    console.log("🔍 Query:", profile.expandedQuery);

    const [vectorResult, keywordResult] = await Promise.all([
        vectorSearch(profile, config),
        keywordSearch(profile, config),
    ]);

    if (!vectorResult.ok && !keywordResult.ok) {
        return null;
    }

    const matches = mergeMatches([vectorResult.matches, keywordResult.matches]);
    const chunks = selectContextChunks(matches, profile, config);

    console.log(
        `📄 RAG kandidat: vector=${vectorResult.matches.length}, keyword=${keywordResult.matches.length}, konteks=${chunks.length}`
    );
    chunks.forEach((chunk, index) => {
        console.log(`  [${index}] ${chunk.tag} score=${chunk.relevance.toFixed(3)} "${chunk.content.slice(0, 110)}"`);
    });

    return {
        context: formatContext(chunks),
        sources: uniqueSources(chunks, config.sourceLimit),
    };
}

// ── Build formatted prompt string ────────────────────────────
async function buildPromptString(question, context) {
    const template = PromptTemplate.fromTemplate(QA_TEMPLATE);
    return template.format({ context, question });
}

// ── Strip common artifacts from LLM output ───────────────────
function cleanAnswer(raw) {
    return String(raw ?? "")
        .replace(/^(Jawaban|Asisten|Assistant)\s*:\s*/i, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n*Sumber\s*:\s*[\s\S]*$/i, "")
        .replace(/\n*(Semoga membantu\.?|Demikian\.?)\s*$/i, "")
        .trim();
}

function formatSources(sources) {
    if (!sources?.length) return "";
    return `\n\nSumber: ${sources.map(formatSourceLabel).join(", ")}`;
}

function appendSources(answer, sources) {
    return `${cleanAnswer(answer)}${formatSources(sources)}`.trim();
}

function getResponseContent(response) {
    if (typeof response === "string") return response;
    if (typeof response?.content === "string") return response.content;
    if (Array.isArray(response?.content)) {
        return response.content
            .map(part => typeof part === "string" ? part : (part?.text ?? ""))
            .join("");
    }
    return "";
}

function getChunkToken(chunk) {
    if (typeof chunk === "string") return chunk;
    if (typeof chunk?.content === "string") return chunk.content;
    if (Array.isArray(chunk?.content)) {
        return chunk.content
            .map(part => typeof part === "string" ? part : (part?.text ?? ""))
            .join("");
    }
    return "";
}

// ─────────────────────────────────────────────────────────────
// processQuestion — returns full string (used by non-streaming proxy)
// ─────────────────────────────────────────────────────────────
export async function processQuestion(question) {
    const directAnswer = getDirectAnswer(question);
    if (directAnswer) return directAnswer;

    const retrieval = await retrieveContext(question);

    if (retrieval === null) {
        return "Sistem database sedang tidak tersedia. Silakan coba beberapa saat lagi.";
    }

    const promptText = await buildPromptString(question, retrieval.context);
    const llm = await getLLM();
    const response = await llm.invoke(promptText);
    return appendSources(getResponseContent(response), retrieval.sources);
}

// ─────────────────────────────────────────────────────────────
// streamQuestion — SSE token stream directly into res
// Caller must set SSE headers before calling this.
// ─────────────────────────────────────────────────────────────
export async function streamQuestion(question, res) {
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const directAnswer = getDirectAnswer(question);
        if (directAnswer) {
            send({ token: directAnswer });
            send({ done: true });
            return res.end();
        }

        const retrieval = await retrieveContext(question);

        if (retrieval === null) {
            send({ error: "Sistem database tidak tersedia." });
            return res.end();
        }

        const promptText = await buildPromptString(question, retrieval.context);
        const llm = await getLLM();

        const stream = await llm.stream(promptText);

        for await (const chunk of stream) {
            const token = getChunkToken(chunk);
            if (!token) continue;
            send({ token });
        }

        const sourceText = formatSources(retrieval.sources);
        if (sourceText) send({ token: sourceText });

        send({ done: true });
        res.end();

    } catch (err) {
        console.error("❌ [streamQuestion] Error:", err.message);
        try {
            res.write(`data: ${JSON.stringify({ error: "Terjadi kesalahan saat memproses jawaban." })}\n\n`);
        } catch {}
        res.end();
    }
}
