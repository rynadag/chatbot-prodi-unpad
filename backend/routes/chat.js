import express from "express";
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();

import { Ollama } from "@langchain/ollama";
import { ConversationalRetrievalQAChain } from "langchain/chains";
// IMPORT helper Atlas Vector Search
import { getVectorStore } from "../utils/ragHelper.js";

const qaTemplate = `Anda adalah asisten virtual khusus untuk Program Studi Magister Ilmu Manajemen (MIM) FEB Unpad.

INSTRUKSI PENTING:
Langkah 1: Analisis topik pertanyaan pengguna.
- Jika pertanyaan bersifat UMUM (contoh: "berapa hari setahun", "siapa presiden", matematika, resep, candaan) atau TIDAK BERHUBUNGAN dengan akademik/kampus, JAWABLAH: "Maaf, saya hanya dapat membantu menjawab pertanyaan seputar informasi akademik dan administrasi Program Studi Magister Ilmu Managemen FEB Unpad."

Langkah 2: Jika pertanyaan BERHUBUNGAN dengan akademik/kampus, periksa "Konteks" di bawah.
- Jika jawaban TIDAK DITEMUKAN di dalam "Konteks", JAWABLAH: "Mohon maaf, informasi spesifik mengenai hal tersebut belum tersedia di dalam database kami. Untuk informasi lebih lanjut, silakan hubungi Helpdesk Akademik FEB Unpad."
- Jika jawaban ADA di "Konteks", jawablah dengan profesional, ramah, dan menggunakan Bahasa Indonesia yang baik. 

Konteks:
{context}

Pertanyaan:
{question}

Jawaban:`;

// Middleware autentikasi tetap dipertahankan
router.use(protect);

router.post("/", async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) return res.status(400).json({ error: "Pertanyaan kosong." });

    // 1. Ambil Vector Store dari Atlas (bukan lagi dari Memory/Cache)
    const vectorstore = await getVectorStore();
    
    if (!vectorstore) {
      return res.status(200).json({ answer: "Sistem database sedang tidak tersedia." });
    }

    const model = new Ollama({
      baseUrl: process.env.OLLAMA_BASE_URL,
      model: process.env.LLM_MODEL,
      streaming: false, 
    });

    // 2. Gunakan vectorstore.asRetriever(6) untuk pencarian Cosine Similarity
    const chain = ConversationalRetrievalQAChain.fromLLM(
      model,
      vectorstore.asRetriever(6), 
      {
        qaTemplate: qaTemplate,
        returnSourceDocuments: true 
      }
    );
    
    // 3. Eksekusi pencarian dan penjawab (Stateless untuk sementara)
    const response = await chain.call({ 
      question: question, 
      chat_history: [] 
    });

    res.json({ answer: response.text });

  } catch (err) {
    console.error("❌ [Chat] Error:", err);
    res.status(500).json({ error: "Terjadi kesalahan sistem saat memproses pesan." });
  }
});

export default router;