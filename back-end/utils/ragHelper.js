/**
 * ragHelper.js
 *
 *  - Mendukung dua embedding provider: ollama (default) dan openai
 *  - Promise-lock singleton (tanpa race condition)
 *  - Batch embedding sync dengan deteksi stale-content/model
 *  - Logging elapsed time
 */

import mongoose      from "mongoose";
import crypto        from "crypto";
import KnowledgeSource from "../models/KnowledgeSource.js";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";

// ── Singleton state ──────────────────────────────────────────
let _cachedVectorStore = null;
let _initPromise       = null;
let _embedder          = null;

function getEmbeddingConfig() {
    const provider = (process.env.EMBEDDING_PROVIDER || "ollama").toLowerCase();
    const model = provider === "openai"
        ? (process.env.EMBEDDING_MODEL || "text-embedding-3-small")
        : (process.env.EMBEDDING_MODEL || "nomic-embed-text");

    return { provider, model };
}

function hashContent(text) {
    return crypto
        .createHash("sha256")
        .update(String(text ?? "").replace(/\s+/g, " ").trim())
        .digest("hex");
}

function needsEmbeddingSync(doc, config) {
    return !Array.isArray(doc.embedding) ||
        doc.embedding.length === 0 ||
        doc.embedding_provider !== config.provider ||
        doc.embedding_model !== config.model ||
        doc.content_hash !== hashContent(doc.content_text);
}

async function embedTexts(embedder, texts) {
    if (typeof embedder.embedDocuments === "function") {
        return embedder.embedDocuments(texts);
    }
    return Promise.all(texts.map(text => embedder.embedQuery(text)));
}

// ── Embedding factory — async, lazy, ESM-safe ────────────────
async function getEmbedder() {
    if (_embedder) return _embedder;

    const { provider, model } = getEmbeddingConfig();

    if (provider === "openai") {
        const { OpenAIEmbeddings } = await import("@langchain/openai");
        _embedder = new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY,
            model,
        });
    } else {
        const { OllamaEmbeddings } = await import("@langchain/ollama");
        _embedder = new OllamaEmbeddings({
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            model,
        });
    }

    console.log(`✅ Embedder siap: ${provider} / ${model}`);
    return _embedder;
}

// ─────────────────────────────────────────────────────────────
// syncEmbeddingsToAtlas
// Jalan saat server start + setelah admin compile.
// ─────────────────────────────────────────────────────────────
export async function syncEmbeddingsToAtlas() {
    const t0 = Date.now();
    console.log("🔄 Mengecek sinkronisasi embedding...");

    const config = getEmbeddingConfig();
    const allSources = await KnowledgeSource.find({})
        .select("tag content_text embedding embedding_provider embedding_model content_hash")
        .lean();
    const sources = allSources.filter(doc => needsEmbeddingSync(doc, config));

    if (!sources.length) {
        console.log("✅ Semua data sudah memiliki embedding. Lewati sinkronisasi.");
        return;
    }

    console.log(`⚙️  Menyinkronisasi ${sources.length} dokumen ke vektor...`);

    let embedder;
    try {
        embedder = await getEmbedder();
    } catch (e) {
        console.error("❌ Gagal membuat embedder:", e.message);
        throw e;
    }

    const BATCH = 5;

    for (let i = 0; i < sources.length; i += BATCH) {
        const batch = sources.slice(i, i + BATCH);

        let vectors;
        try {
            vectors = await embedTexts(embedder, batch.map(doc => doc.content_text));
        } catch (e) {
            console.error(`❌ Gagal embed batch ${i / BATCH + 1}:`, e.message);
            throw e;
        }

        await Promise.all(
            batch.map((doc, idx) =>
                KnowledgeSource.updateOne(
                    { _id: doc._id },
                    {
                        $set: {
                            embedding: vectors[idx],
                            last_compiled: new Date(),
                            embedding_provider: config.provider,
                            embedding_model: config.model,
                            content_hash: hashContent(doc.content_text),
                        },
                    }
                )
            )
        );

        console.log(
            `  ✔ Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(sources.length / BATCH)}: ` +
            batch.map(d => d.tag).join(", ")
        );
    }

    resetVectorStore();

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`🚀 Sinkronisasi selesai dalam ${elapsed}s. Cache direset.`);
}

// ─────────────────────────────────────────────────────────────
// getVectorStore — singleton dengan Promise-lock
// ─────────────────────────────────────────────────────────────
export async function getVectorStore() {
    if (_cachedVectorStore) return _cachedVectorStore;

    if (_initPromise) return _initPromise;

    _initPromise = _init()
        .then(store => {
            if (!store) _initPromise = null;
            return store;
        })
        .catch(err => {
            _initPromise = null;
            throw err;
        });

    return _initPromise;
}

async function _init() {
    try {
        console.log("🔧 Menghubungkan Vector Store ke MongoDB Atlas...");

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connection.asPromise();
        }

        const dbName = process.env.MONGO_DB_NAME || mongoose.connection.db?.databaseName;
        const db = dbName
            ? mongoose.connection.getClient().db(dbName)
            : mongoose.connection.db;

        if (!db) {
            throw new Error("Database MongoDB belum siap.");
        }

        const collection = db.collection(KnowledgeSource.collection.name);
        const embedder   = await getEmbedder();

        const vectorStore = new MongoDBAtlasVectorSearch(embedder, {
            collection,
            indexName:    process.env.MONGO_VECTOR_INDEX || "vector_index",
            textKey:      "content_text",
            embeddingKey: "embedding",
        });

        _cachedVectorStore = vectorStore;
        console.log("✅ Vector Store siap.");
        return vectorStore;

    } catch (err) {
        console.error("❌ Gagal inisialisasi Vector Store:", err.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// resetVectorStore — dipanggil setelah embedding sync
// ─────────────────────────────────────────────────────────────
export function resetVectorStore() {
    _cachedVectorStore = null;
    _initPromise       = null;
    _embedder          = null;
    console.log("🔄 Vector store + embedder cache direset.");
}
