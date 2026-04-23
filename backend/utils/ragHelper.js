/**
 * ragHelper.js — v3.1
 *
 * FIXED: replaced require() (CommonJS) with ESM-compatible dynamic import().
 * This file is part of an "type":"module" project — require() crashes at runtime.
 *
 * Changes from v2:
 *  - Supports two embedding providers: ollama (default) and openai
 *  - Promise-lock singleton (no race conditions)
 *  - Parallel batch embedding sync
 *  - Elapsed-time logging
 */

import mongoose from "mongoose";
import KnowledgeSource from "../models/KnowledgeSource.js";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";

// ── Singleton state ──────────────────────────────────────────
let _cachedVectorStore = null;
let _initPromise       = null;
let _embedder          = null; // cached embedder instance

// ── Embedding factory — async, lazy, ESM-safe ────────────────
async function getEmbedder() {
    if (_embedder) return _embedder;

    const provider = (process.env.EMBEDDING_PROVIDER || "ollama").toLowerCase();

    if (provider === "openai") {
        const { OpenAIEmbeddings } = await import("@langchain/openai");
        _embedder = new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY,
            model:  process.env.EMBEDDING_MODEL || "text-embedding-3-small",
        });
    } else {
        const { OllamaEmbeddings } = await import("@langchain/ollama");
        _embedder = new OllamaEmbeddings({
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            model:   process.env.EMBEDDING_MODEL || "nomic-embed-text",
        });
    }

    console.log(`✅ Embedder siap: ${provider}`);
    return _embedder;
}

// ─────────────────────────────────────────────────────────────
// syncEmbeddingsToAtlas
// Runs on server start + after admin compile action.
// ─────────────────────────────────────────────────────────────
export async function syncEmbeddingsToAtlas() {
    const t0 = Date.now();
    console.log("🔄 Mengecek sinkronisasi embedding...");

    const sources = await KnowledgeSource.find({
        $or: [
            { embedding: { $exists: false } },
            { embedding: { $size: 0 } },
            { embedding: null },
        ],
    }).lean();

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

    const BATCH = 5; // Sesuaikan jika Ollama/OpenAI punya rate limit

    for (let i = 0; i < sources.length; i += BATCH) {
        const batch = sources.slice(i, i + BATCH);

        let vectors;
        try {
            vectors = await Promise.all(
                batch.map(doc => embedder.embedQuery(doc.content_text))
            );
        } catch (e) {
            console.error(`❌ Gagal embed batch ${i / BATCH + 1}:`, e.message);
            throw e;
        }

        await Promise.all(
            batch.map((doc, idx) =>
                KnowledgeSource.updateOne(
                    { _id: doc._id },
                    { $set: { embedding: vectors[idx], last_compiled: new Date() } }
                )
            )
        );

        console.log(
            `  ✔ Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(sources.length / BATCH)}: ` +
            batch.map(d => d.tag).join(", ")
        );
    }

    // Reset cache so next query uses fresh embeddings
    resetVectorStore();

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`🚀 Sinkronisasi selesai dalam ${elapsed}s. Cache direset.`);
}

// ─────────────────────────────────────────────────────────────
// getVectorStore — singleton with Promise-lock (no race conditions)
// ─────────────────────────────────────────────────────────────
export async function getVectorStore() {
    if (_cachedVectorStore) return _cachedVectorStore;

    if (_initPromise) return _initPromise;

    _initPromise = _init()
        .then(store => {
            if (!store) _initPromise = null; // allow retry on failure
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

        const collection = mongoose.connection
            .getClient()
            .db("chatbot_db")
            .collection("knowledgesources");

        const embedder = await getEmbedder();

        const vectorStore = new MongoDBAtlasVectorSearch(embedder, {
            collection,
            indexName:    "vector_index",
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
// resetVectorStore — call after embedding sync
// ─────────────────────────────────────────────────────────────
export function resetVectorStore() {
    _cachedVectorStore = null;
    _initPromise       = null;
    _embedder          = null; // allow re-init with fresh config
    console.log("🔄 Vector store + embedder cache direset.");
}
