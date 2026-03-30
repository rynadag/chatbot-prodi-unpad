import mongoose from "mongoose";
import KnowledgeSource from "../models/KnowledgeSource.js";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";

// SINGLETON: Simpan vector store agar tidak perlu inisialisasi berulang
let cachedVectorStore = null;
let isInitializing = false;

/**
 * Fungsi untuk mensinkronisasi teks ke vector (embedding) di MongoDB Atlas.
 * Dijalankan otomatis saat server start.
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
        });

        if (sources.length === 0) {
            console.log("✅ Semua data sudah memiliki embedding.");
            return;
        }

        console.log(`⚙️ Mengonversi ${sources.length} data menjadi vektor...`);

        const embeddings = new OllamaEmbeddings({
            baseUrl: process.env.OLLAMA_BASE_URL,
            model: process.env.EMBEDDING_MODEL,
        });

        for (const doc of sources) {
            const vector = await embeddings.embedQuery(doc.content_text);
            await KnowledgeSource.updateOne(
                { _id: doc._id },
                { $set: { embedding: vector, last_compiled: new Date() } }
            );
            console.log(`✔ [${doc.tag}] Berhasil di-embed.`);
        }
        console.log("🚀 Proses sinkronisasi selesai!");
    } catch (error) {
        console.error("❌ Gagal saat sinkronisasi embedding:", error);
    }
}

/**
 * Menginisialisasi Vector Store menggunakan koneksi Mongoose yang sudah aktif.
 * MENGGUNAKAN SINGLETON PATTERN - Hanya inisialisasi sekali.
 */
export async function getVectorStore() {
    // 1. Jika sudah ada cache, langsung return
    if (cachedVectorStore) {
        return cachedVectorStore;
    }

    // 2. Jika sedang proses inisialisasi oleh request lain, tunggu sebentar
    if (isInitializing) {
        console.log("⏳ Vector store sedang diinisialisasi, menunggu...");
        let attempts = 0;
        while (isInitializing && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        if (cachedVectorStore) {
            return cachedVectorStore;
        }
    }

    isInitializing = true;

    try {
        console.log("🔧 Menghubungkan ke MongoDB Atlas Vector Search...");
        
        // 3. Pastikan Mongoose sudah terkoneksi penuh
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connection.asPromise();
        }

        // 4. Ambil native client dari Mongoose (Cara paling aman di Mongoose v8)
        const client = mongoose.connection.getClient();
        
        // Pastikan nama database 'chatbot_db' sesuai dengan yang ada di Atlas
        const db = client.db("chatbot_db"); 
        const collection = db.collection("knowledgesources");

        // 5. Inisialisasi embeddings Ollama
        const embeddings = new OllamaEmbeddings({
            baseUrl: process.env.OLLAMA_BASE_URL,
            model: process.env.EMBEDDING_MODEL,
        });

        // 6. INISIALISASI VECTOR STORE (Perbaikan Utama: gunakan 'collection', BUKAN 'mongodbCollection')
        const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
            collection: collection, 
            indexName: "vector_index",      
            textKey: "content_text",       
            embeddingKey: "embedding",     
        });

        console.log("✅ Vector Store berhasil dihubungkan!");
        
        // 7. Simpan ke cache agar chat berikutnya super cepat
        cachedVectorStore = vectorStore;
        isInitializing = false;
        
        return vectorStore;

    } catch (error) {
        console.error("❌ Gagal inisialisasi MongoDB Vector Store:", error.message);
        console.error("Stack trace:", error.stack);
        isInitializing = false;
        return null;
    }
}

/**
 * Reset cache vector store (Berguna jika ada pembaruan data secara massal)
 */
export function resetVectorStore() {
    cachedVectorStore = null;
    isInitializing = false;
    console.log("🔄 Vector store cache telah direset");
}