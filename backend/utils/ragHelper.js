import mongoose from "mongoose";
import KnowledgeSource from "../models/KnowledgeSource.js";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";

// SINGLETON: Simpan vector store agar tidak perlu inisialisasi berulang
let cachedVectorStore = null;
// Promise-based lock — lebih andal daripada busy-wait loop
let initPromise = null;

/**
 * Sinkronisasi teks ke vektor (embedding) di MongoDB Atlas.
 * Dijalankan otomatis saat server start atau dipanggil manual dari admin.
 * Proses embedding dilakukan PARALEL (batch) agar lebih cepat.
 */
export async function syncEmbeddingsToAtlas() {
    console.log("🔄 Mengecek sinkronisasi embedding ke MongoDB Atlas...");
    try {
        const sources = await KnowledgeSource.find({
            $or: [
                { embedding: { $exists: false } },
                { embedding: { $size: 0 } },
                { embedding: null }
            ]
        }).lean(); // .lean() — plain object, lebih cepat

        if (sources.length === 0) {
            console.log("✅ Semua data sudah memiliki embedding.");
            return;
        }

        console.log(`⚙️ Mengonversi ${sources.length} data menjadi vektor (paralel batch)...`);

        const embeddings = new OllamaEmbeddings({
            baseUrl: process.env.OLLAMA_BASE_URL,
            model: process.env.EMBEDDING_MODEL,
        });

        // Proses embedding PARALEL dengan batch size agar tidak overload Ollama
        const BATCH_SIZE = 5;
        for (let i = 0; i < sources.length; i += BATCH_SIZE) {
            const batch = sources.slice(i, i + BATCH_SIZE);

            // Jalankan embedQuery secara paralel dalam satu batch
            const vectors = await Promise.all(
                batch.map(doc => embeddings.embedQuery(doc.content_text))
            );

            // Simpan hasil batch ke DB secara paralel
            await Promise.all(
                batch.map((doc, idx) =>
                    KnowledgeSource.updateOne(
                        { _id: doc._id },
                        { $set: { embedding: vectors[idx], last_compiled: new Date() } }
                    )
                )
            );

            console.log(`✔ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.map(d => d.tag).join(", ")} berhasil di-embed.`);
        }

        // Reset cache agar vector store pakai data terbaru
        resetVectorStore();
        console.log("🚀 Sinkronisasi selesai! Cache vector store direset.");
    } catch (error) {
        console.error("❌ Gagal saat sinkronisasi embedding:", error);
        throw error;
    }
}

/**
 * Mendapatkan Vector Store dengan singleton + Promise lock (aman dari race condition).
 */
export async function getVectorStore() {
    if (cachedVectorStore) return cachedVectorStore;

    if (initPromise) return initPromise;

    initPromise = _initVectorStore().then(result => {
        if (!result) initPromise = null; // reset agar bisa retry jika gagal
        return result;
    });

    return initPromise;
}

async function _initVectorStore() {
    try {
        console.log("🔧 Menghubungkan ke MongoDB Atlas Vector Search...");

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connection.asPromise();
        }

        const client = mongoose.connection.getClient();
        const db = client.db("chatbot_db");
        const collection = db.collection("knowledgesources");

        const embeddings = new OllamaEmbeddings({
            baseUrl: process.env.OLLAMA_BASE_URL,
            model: process.env.EMBEDDING_MODEL,
        });

        const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
            collection: collection,
            indexName: "vector_index",
            textKey: "content_text",
            embeddingKey: "embedding",
        });

        console.log("✅ Vector Store berhasil dihubungkan!");
        cachedVectorStore = vectorStore;
        return vectorStore;

    } catch (error) {
        console.error("❌ Gagal inisialisasi MongoDB Vector Store:", error.message);
        return null;
    }
}

/**
 * Reset cache vector store. Dipanggil otomatis setelah sync selesai.
 */
export function resetVectorStore() {
    cachedVectorStore = null;
    initPromise = null;
    console.log("🔄 Vector store cache telah direset.");
}
