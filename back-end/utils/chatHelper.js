/**
 * chatHelper.js — Chatbot Prodi Unpad (Generic / Multi-Prodi)
 *
 * Semua identitas prodi (nama, singkatan, fakultas, universitas)
 * dibaca dari .env sehingga file ini TIDAK perlu diubah per-prodi.
 *
 * Fitur:
 *  - Prompt template dinamis dari env
 *  - Hybrid RAG: vector retrieval + keyword fallback + chunk reranking
 *  - Streaming SSE via streamQuestion()
 *  - Direct-answer untuk sapaan/basa-basi
 *  - Query expansion generik untuk semua jenis prodi akademik
 */

import { ChatGroq }       from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import mongoose           from "mongoose";
import KnowledgeSource    from "../models/KnowledgeSource.js";
import { getVectorStore } from "./ragHelper.js";

// ── Prodi identity (dibaca sekali, di-cache) ─────────────────
let _prodiConfig = null;

function getProdiConfig() {
    if (_prodiConfig) return _prodiConfig;
    _prodiConfig = {
        prodiName:     process.env.PRODI_NAME          || "Program Studi",
        prodiAbbrev:   process.env.PRODI_ABBREVIATION   || "Prodi",
        prodiLevel:    process.env.PRODI_LEVEL          || "",
        facultyName:   process.env.FACULTY_NAME         || "Fakultas",
        facultyAbbrev: process.env.FACULTY_ABBREVIATION || "",
        univName:      process.env.UNIV_NAME            || "Universitas Padjadjaran",
        univAbbrev:    process.env.UNIV_ABBREVIATION    || "Unpad",
        helpdesk:      process.env.HELPDESK_CONTACT     || "admin prodi",
    };
    return _prodiConfig;
}

// ── Prompt template (dibuat dinamis dari env) ─────────────────
function buildQaTemplate() {
    const { prodiName, prodiAbbrev, facultyName, facultyAbbrev, univName, univAbbrev, helpdesk } = getProdiConfig();
    const prodiFull  = [prodiName, facultyName, univName].filter(Boolean).join(" ");
    const prodiShort = [prodiAbbrev || prodiName, facultyAbbrev || facultyName, univAbbrev].filter(Boolean).join(" ");

    return `Anda adalah asisten virtual resmi ${prodiFull}.

Tugas utama Anda adalah membantu pertanyaan seputar ${prodiShort}, termasuk akademik, kurikulum, tugas akhir, administrasi, fasilitas, pendaftaran, pimpinan, dan informasi umum yang relevan dengan prodi.

GAYA JAWABAN:
- Gunakan Bahasa Indonesia yang natural, ramah, dan profesional. Tidak perlu kaku atau terlalu formal.
- Jawab langsung inti pertanyaan. Gunakan poin-poin jika jawabannya berisi daftar, syarat, atau langkah.
- Boleh menambahkan kalimat pendek yang membantu alur, tetapi jangan bertele-tele.
- Jangan menyebut "berdasarkan konteks" kecuali memang perlu untuk menjelaskan keterbatasan data.
- Jangan menulis bagian "Sumber"; sistem akan menambahkannya otomatis setelah jawaban.

BATASAN WAJIB:
- Gunakan hanya informasi dari KONTEKS untuk fakta spesifik seperti nama, tanggal, biaya, syarat, jadwal, SKS, nilai, lokasi, dan prosedur.
- Jika pertanyaan relevan tetapi informasinya tidak ada atau tidak cukup jelas di KONTEKS, jawab dengan jujur bahwa data tersebut belum tersedia di database, lalu arahkan pengguna menghubungi ${helpdesk}.
- Jika pertanyaan jelas di luar lingkup ${prodiFull}, jawab singkat dan ramah bahwa Anda hanya bisa membantu seputar ${prodiShort}.
- Jika KONTEKS berisi beberapa potongan yang mirip, prioritaskan informasi yang paling spesifik.
- Jangan mengarang, menebak, atau memakai pengetahuan di luar KONTEKS.

--- KONTEKS ---
{context}

--- PERTANYAAN ---
{question}

--- JAWABAN ---`;
}

// ── LLM Singleton ─────────────────────────────────────────────
let _llm = null;

async function getLLM() {
    if (_llm) return _llm;
    const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();

    if (provider === "groq") {
        _llm = new ChatGroq({
            apiKey:      process.env.GROQ_API_KEY,
            model:       process.env.GROQ_MODEL || "llama-3.1-8b-instant",
            temperature: parseFloat(process.env.LLM_TEMPERATURE ?? "0.2"),
            maxTokens:   parseInt(process.env.LLM_MAX_TOKENS ?? "768", 10),
        });
        console.log(`✅ LLM siap: Groq / ${process.env.GROQ_MODEL || "llama-3.1-8b-instant"}`);
    } else {
        const { Ollama } = await import("@langchain/ollama");
        _llm = new Ollama({
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            model:   process.env.LLM_MODEL || "llama3.1",
        });
        console.log(`✅ LLM siap: Ollama / ${process.env.LLM_MODEL || "llama3.1"}`);
    }
    return _llm;
}

// ── Query expansions — generik untuk semua jenis prodi ────────
const QUERY_EXPANSIONS = [
    {
        keywords: ["ketua prodi", "kaprodi", "ka prodi", "ketua program studi", "pimpinan prodi", "kepala prodi", "kepala program studi"],
        expand:   ["ketua program studi", "kepala program studi", "pimpinan prodi"],
    },
    {
        keywords: ["sekprodi", "sekretaris prodi", "sekretaris program studi"],
        expand:   ["sekretaris program studi", "sekretaris prodi"],
    },
    {
        keywords: ["dekan", "wakil dekan", "wadek", "pimpinan fakultas"],
        expand:   ["dekan", "wakil dekan", "pimpinan fakultas"],
    },
    {
        keywords: ["dosen", "pengajar", "staf pengajar", "tenaga pengajar", "pembimbing", "supervisor"],
        expand:   ["dosen", "staf pengajar", "tenaga pengajar", "dosen pembimbing"],
    },
    {
        keywords: ["biaya", "ukt", "spp", "bayar", "pembayaran", "biaya kuliah", "iuran", "biaya pendidikan"],
        expand:   ["biaya kuliah", "UKT", "SPP", "pembayaran semester", "biaya pendidikan"],
    },
    {
        keywords: ["daftar", "pendaftaran", "registrasi", "admisi", "pmb", "masuk", "seleksi", "penerimaan"],
        expand:   ["pendaftaran", "registrasi", "penerimaan mahasiswa baru", "PMB", "admisi", "seleksi masuk"],
    },
    {
        keywords: ["kurikulum", "sks", "mata kuliah", "matkul", "semester", "jadwal", "kalender akademik", "rencana studi"],
        expand:   ["kurikulum", "struktur kurikulum", "mata kuliah", "SKS", "semester", "jadwal perkuliahan"],
    },
    {
        keywords: ["skripsi", "tesis", "disertasi", "tugas akhir", "ta", "penelitian", "seminar proposal", "sidang"],
        expand:   ["tugas akhir", "skripsi", "tesis", "seminar proposal", "penelitian", "sidang", "ujian akhir"],
    },
    {
        keywords: ["nilai", "ipk", "ips", "kelulusan", "yudisium", "cumlaude", "pujian", "wisuda", "lulus"],
        expand:   ["penilaian", "IPK", "IPS", "kelulusan", "yudisium", "wisuda", "Pujian"],
    },
    {
        keywords: ["kampus", "alamat", "lokasi", "fasilitas", "perpustakaan", "ruang kuliah", "laboratorium", "lab", "gedung"],
        expand:   ["lokasi kampus", "fasilitas", "perpustakaan", "ruang kuliah", "laboratorium"],
    },
    {
        keywords: ["konsentrasi", "peminatan", "jalur studi", "pilihan studi", "program studi lanjut"],
        expand:   ["konsentrasi", "peminatan", "jalur studi"],
    },
    {
        keywords: ["visi", "misi", "tujuan", "tagline", "sejarah", "profil prodi", "tentang prodi", "profil program"],
        expand:   ["visi", "misi", "tujuan", "sejarah", "profil program studi"],
    },
    {
        keywords: ["profil lulusan", "lulusan", "kompetensi", "capaian pembelajaran", "cpl", "capaian lulusan"],
        expand:   ["profil lulusan", "kompetensi lulusan", "capaian pembelajaran", "CPL"],
    },
    {
        keywords: ["cuti", "herregistrasi", "registrasi ulang", "drop out", "do", "pemutusan studi", "sanksi", "peringatan akademik"],
        expand:   ["herregistrasi", "registrasi ulang", "pemutusan studi", "sanksi akademik", "peringatan akademik"],
    },
    {
        keywords: ["beasiswa", "bantuan biaya", "kip", "bidikmisi", "afirmasi", "bantuan pendidikan"],
        expand:   ["beasiswa", "bantuan biaya pendidikan", "KIP-Kuliah", "beasiswa prestasi"],
    },
    {
        keywords: ["akreditasi", "akreditasi prodi", "ban-pt", "sertifikasi", "peringkat prodi"],
        expand:   ["akreditasi", "BAN-PT", "akreditasi program studi"],
    },
    {
        keywords: ["publikasi", "jurnal", "artikel ilmiah", "prosiding", "konferensi", "paper"],
        expand:   ["publikasi ilmiah", "jurnal", "artikel ilmiah", "prosiding", "konferensi akademik"],
    },
    {
        keywords: ["organisasi", "himpunan", "bem", "ukm", "kemahasiswaan", "kegiatan mahasiswa"],
        expand:   ["organisasi mahasiswa", "kemahasiswaan", "himpunan", "kegiatan mahasiswa"],
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

const SHORT_TOKEN_ALLOWLIST = new Set([
    "do", "ip", "ipk", "ips", "pmb", "s1", "s2", "s3", "sks", "ta", "cpl", "ban",
]);

// ── Utilities ─────────────────────────────────────────────────
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
        fetchK:          parsePositiveInt(process.env.RAG_FETCH_K ?? process.env.RAG_CANDIDATE_K, Math.max(10, contextChunks * 3)),
        keywordLimit:    parsePositiveInt(process.env.RAG_KEYWORD_LIMIT, 12),
        contextChunks,
        maxChunkChars:   parsePositiveInt(process.env.RAG_CHUNK_CHARS, 760),
        chunkOverlap:    parsePositiveInt(process.env.RAG_CHUNK_OVERLAP, 80),
        maxContextChars: parsePositiveInt(process.env.RAG_MAX_CONTEXT_CHARS, 3600),
        minVectorScore:  parseNumber(process.env.RAG_MIN_VECTOR_SCORE, 0.62),
        minChunkScore:   parseNumber(process.env.RAG_MIN_CHUNK_SCORE, 0.12),
        sourceLimit:     parsePositiveInt(process.env.RAG_SOURCE_LIMIT, 3),
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
    const nk = normalizeText(keyword);
    if (!nk) return false;
    return nk.length <= 2
        ? text.split(/\s+/).includes(nk)
        : text.includes(nk);
}

function getMatchedExpansions(normalizedQuestion) {
    const expansions = [];
    for (const item of QUERY_EXPANSIONS) {
        if (item.keywords.some(kw => includesKeyword(normalizedQuestion, kw))) {
            expansions.push(...item.expand);
        }
    }
    return unique(expansions);
}

function expandQuery(question) {
    const normalizedQuestion = normalizeText(question);
    const expansions = getMatchedExpansions(normalizedQuestion);
    return expansions.length ? `${question} ${expansions.join(" ")}` : question;
}

function createSearchProfile(question) {
    const normalizedQuestion = normalizeText(question);
    const expansions    = getMatchedExpansions(normalizedQuestion);
    const expandedQuery = expandQuery(question);
    const tokens  = tokenize(expandedQuery).slice(0, 24);
    const phrases = unique([
        ...expansions.map(normalizeText),
        ...QUERY_EXPANSIONS.flatMap(item =>
            item.keywords
                .filter(kw => includesKeyword(normalizedQuestion, kw))
                .map(normalizeText)
        ),
    ]).filter(p => p.length >= 3);

    return { original: question, normalizedQuestion, expandedQuery, tokens, phrases };
}

// ── Direct answers for chitchat ───────────────────────────────
function getDirectAnswer(question) {
    const q = normalizeText(question);
    const { prodiName, prodiAbbrev, facultyName, facultyAbbrev, univAbbrev } = getProdiConfig();
    const short = [prodiAbbrev || prodiName, facultyAbbrev || facultyName, univAbbrev].filter(Boolean).join(" ");

    if (/^(halo|hai|hi|hello|assalamualaikum|assalamu alaikum|permisi|selamat pagi|selamat siang|selamat sore|selamat malam)(\s+(admin|min|kak|bot))?$/.test(q)) {
        return `Halo! Saya asisten virtual ${short}. Silakan tanya seputar akademik, administrasi, kurikulum, tugas akhir, pendaftaran, atau informasi prodi.`;
    }

    if (/^(terima kasih|makasih|thanks|thank you|thx)(\s+(banyak|ya|admin|min|kak|bot))*$/.test(q)) {
        return `Sama-sama. Kalau ada pertanyaan lain seputar ${short}, silakan tanya.`;
    }

    if (/^(apa kabar|gimana kabarnya|bagaimana kabarnya)$/.test(q)) {
        return `Baik, terima kasih. Saya siap membantu pertanyaan seputar ${short}.`;
    }

    if (/^(siapa kamu|kamu siapa|anda siapa|ini bot apa|ini chatbot apa|apa ini)$/.test(q)) {
        return `Saya asisten virtual ${prodiName} ${facultyName}. Saya membantu menjawab informasi prodi berdasarkan data yang tersedia.`;
    }

    return null;
}

// ── Text processing ───────────────────────────────────────────
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
            if (pivot > start + Math.floor(maxChars * 0.65)) end = pivot;
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
        .map(p => p.trim())
        .filter(Boolean);

    if (qaParts.length > 1) {
        return qaParts.flatMap(part =>
            part.length > config.maxChunkChars
                ? hardSplit(part, config.maxChunkChars, config.chunkOverlap)
                : [part]
        );
    }

    if (clean.length <= config.maxChunkChars) return [clean];

    const sentences = clean
        .split(/(?<=[.!?])\s+|(?=\b\d+\.\s+)/g)
        .map(s => s.trim())
        .filter(Boolean);

    if (sentences.length <= 1) return hardSplit(clean, config.maxChunkChars, config.chunkOverlap);

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
    if (tagPart && profile.tokens.some(t => tagPart.includes(t))) score += 1.5;

    return score;
}

// ── Search ────────────────────────────────────────────────────
async function vectorSearch(profile, config) {
    const vectorStore = await getVectorStore();
    if (!vectorStore) return { ok: false, matches: [] };

    try {
        const docs = await vectorStore.similaritySearchWithScore(profile.expandedQuery, config.fetchK);
        return {
            ok: true,
            matches: docs.map(([doc, score], index) => ({
                id:              String(doc.metadata?._id ?? doc.metadata?.id ?? doc.metadata?.tag ?? `vector-${index}`),
                tag:             doc.metadata?.tag || "tanpa_tag",
                content:         doc.pageContent || "",
                vectorScore:     Number(score) || 0,
                keywordDocScore: 0,
                source:          "vector",
            })),
        };
    } catch (err) {
        console.error("❌ Vector search gagal, fallback ke keyword:", err.message);
        return { ok: false, matches: [] };
    }
}

async function keywordSearch(profile, config) {
    if (mongoose.connection.readyState !== 1) return { ok: false, matches: [] };

    const terms = unique([...profile.phrases, ...profile.tokens])
        .map(t => normalizeText(t).slice(0, 60))
        .filter(t => t.length >= 3 || SHORT_TOKEN_ALLOWLIST.has(t))
        .slice(0, 14);

    if (!terms.length) return { ok: true, matches: [] };

    try {
        const searchableTag     = { $toLower: { $ifNull: ["$tag", ""] } };
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
                id:              String(doc._id),
                tag:             doc.tag || "tanpa_tag",
                content:         doc.content_text || "",
                vectorScore:     0,
                keywordDocScore: scoreTextAgainstProfile(`${doc.tag} ${doc.content_text}`, profile),
                source:          "keyword",
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
        const key      = match.id || match.tag || cleanContent(match.content).slice(0, 80);
        const existing = byId.get(key);
        if (!existing) {
            byId.set(key, { ...match, sources: new Set([match.source]) });
            continue;
        }
        existing.vectorScore     = Math.max(existing.vectorScore     || 0, match.vectorScore     || 0);
        existing.keywordDocScore = Math.max(existing.keywordDocScore || 0, match.keywordDocScore || 0);
        existing.content         = existing.content.length >= match.content.length ? existing.content : match.content;
        existing.sources.add(match.source);
    }
    return [...byId.values()];
}

function scoreChunk(chunk, profile, config) {
    const text        = `${chunk.tag} ${chunk.content}`;
    const lexical     = scoreTextAgainstProfile(text, profile);
    const tokenScore  = profile.tokens.length ? Math.min(lexical / Math.max(profile.tokens.length, 1), 1) : 0;
    const vectorBoost = clamp(((chunk.vectorScore || 0) - config.minVectorScore) * 0.7, 0, 0.28);
    const kwBoost     = clamp((chunk.keywordDocScore || 0) * 0.025, 0, 0.24);
    return tokenScore * 0.58 + vectorBoost + kwBoost;
}

function selectContextChunks(matches, profile, config) {
    const scored = [];
    for (const match of matches) {
        splitIntoChunks(match.content, config).forEach((content, chunkIndex) => {
            const chunk = { ...match, content, chunkIndex };
            scored.push({ ...chunk, relevance: scoreChunk(chunk, profile, config) });
        });
    }

    const filtered = scored
        .filter(c =>
            c.relevance >= config.minChunkScore ||
            (c.vectorScore || 0) >= config.minVectorScore ||
            (c.keywordDocScore || 0) >= 2
        )
        .sort((a, b) => b.relevance !== a.relevance
            ? b.relevance - a.relevance
            : (b.vectorScore || 0) - (a.vectorScore || 0)
        );

    const selected     = [];
    const fingerprints = new Set();
    let totalChars     = 0;

    for (const chunk of filtered) {
        const fp = normalizeText(chunk.content).slice(0, 180);
        if (!fp || fingerprints.has(fp)) continue;
        const nextTotal = totalChars + chunk.content.length;
        if (selected.length && nextTotal > config.maxContextChars) continue;
        selected.push(chunk);
        fingerprints.add(fp);
        totalChars = nextTotal;
        if (selected.length >= config.contextChunks) break;
    }
    return selected;
}

function getChunkSource(chunk) {
    return {
        tag:   chunk.tag || "tanpa_tag",
        id:    chunk.id  || null,
        score: Number.isFinite(chunk.relevance) ? Number(chunk.relevance.toFixed(3)) : null,
    };
}

function uniqueSources(chunks, limit) {
    const sources = [];
    const seen    = new Set();
    for (const chunk of chunks) {
        const source = getChunkSource(chunk);
        const key    = source.tag || source.id;
        if (!key || seen.has(key)) continue;
        sources.push(source);
        seen.add(key);
        if (sources.length >= limit) break;
    }
    return sources;
}

function formatContext(chunks) {
    if (!chunks.length) return "Tidak ada konteks relevan yang ditemukan di database.";
    return chunks
        .map((chunk, i) => `[${i + 1}] Sumber: ${chunk.tag}\n${chunk.content}`)
        .join("\n\n---\n\n");
}

async function retrieveContext(question) {
    const config  = getRagConfig();
    const profile = createSearchProfile(question);

    console.log("🔍 Query:", profile.expandedQuery);

    const [vectorResult, keywordResult] = await Promise.all([
        vectorSearch(profile, config),
        keywordSearch(profile, config),
    ]);

    if (!vectorResult.ok && !keywordResult.ok) return null;

    const matches = mergeMatches([vectorResult.matches, keywordResult.matches]);
    const chunks  = selectContextChunks(matches, profile, config);

    console.log(
        `📄 RAG kandidat: vector=${vectorResult.matches.length}, ` +
        `keyword=${keywordResult.matches.length}, konteks=${chunks.length}`
    );
    chunks.forEach((c, i) =>
        console.log(`  [${i}] ${c.tag} score=${c.relevance.toFixed(3)} "${c.content.slice(0, 110)}"`)
    );

    return { context: formatContext(chunks), sources: [] };
}

// ── Prompt & LLM helpers ──────────────────────────────────────
async function buildPromptString(question, context) {
    const template = PromptTemplate.fromTemplate(buildQaTemplate());
    return template.format({ context, question });
}

function cleanAnswer(raw) {
    return String(raw ?? "")
        .replace(/^(Jawaban|Asisten|Assistant)\s*:\s*/i, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n*Sumber\s*:\s*[\s\S]*$/i, "")
        .replace(/\n*(Semoga membantu\.?|Demikian\.?)\s*$/i, "")
        .trim();
}

function formatSources(sources) {
    return "";
}

function appendSources(answer, sources) {
    return `${cleanAnswer(answer)}${formatSources(sources)}`.trim();
}

function getResponseContent(response) {
    if (typeof response === "string") return response;
    if (typeof response?.content === "string") return response.content;
    if (Array.isArray(response?.content))
        return response.content.map(p => typeof p === "string" ? p : (p?.text ?? "")).join("");
    return "";
}

function getChunkToken(chunk) {
    if (typeof chunk === "string") return chunk;
    if (typeof chunk?.content === "string") return chunk.content;
    if (Array.isArray(chunk?.content))
        return chunk.content.map(p => typeof p === "string" ? p : (p?.text ?? "")).join("");
    return "";
}

// ── Public API ────────────────────────────────────────────────

/**
 * processQuestion — full string response (non-streaming)
 */
export async function processQuestion(question) {
    const directAnswer = getDirectAnswer(question);
    if (directAnswer) return directAnswer;

    const retrieval = await retrieveContext(question);
    if (retrieval === null) return "Sistem database sedang tidak tersedia. Silakan coba beberapa saat lagi.";

    const promptText = await buildPromptString(question, retrieval.context);
    const llm        = await getLLM();
    const response   = await llm.invoke(promptText);
    return appendSources(getResponseContent(response), retrieval.sources);
}

/**
 * streamQuestion — SSE token stream.
 * Caller harus set SSE headers sebelum memanggil fungsi ini.
 */
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
        const llm        = await getLLM();
        const stream     = await llm.stream(promptText);

        for await (const chunk of stream) {
            const token = getChunkToken(chunk);
            if (token) send({ token });
        }

        const sourceText = formatSources(retrieval.sources);
        if (sourceText) send({ token: sourceText });

        send({ done: true });
        res.end();

    } catch (err) {
        console.error("❌ [streamQuestion] Error:", err.message);
        try { res.write(`data: ${JSON.stringify({ error: "Terjadi kesalahan saat memproses jawaban." })}\n\n`); } catch {}
        res.end();
    }
}
