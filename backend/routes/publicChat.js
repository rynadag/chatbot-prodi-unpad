import express from "express";
const router = express.Router();

import { Ollama } from "@langchain/ollama"; // GANTI INI
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { getVectorStore } from "../utils/ragHelper.js";

const qaTemplate = `Anda adalah asisten virtual khusus untuk Program Studi Magister Ilmu Manajemen (MIM) FEB Unpad.

INSTRUKSI PENTING:
Langkah 1: Analisis topik pertanyaan pengguna.
- Jika pertanyaan bersifat UMUM atau TIDAK BERHUBUNGAN dengan akademik/kampus, JAWABLAH: "Maaf, saya hanya dapat membantu menjawab pertanyaan seputar informasi akademik dan administrasi Program Studi MIM FEB Unpad."

Langkah 2: Jika pertanyaan BERHUBUNGAN dengan akademik/kampus, periksa "Konteks" di bawah.
- Jika jawaban TIDAK DITEMUKAN di dalam "Konteks", JAWABLAH: "Mohon maaf, informasi spesifik mengenai hal tersebut belum tersedia di dalam database kami. Untuk informasi lebih lanjut, silakan hubungi Helpdesk Akademik FEB Unpad."
- Jika jawaban ADA di "Konteks", jawablah dengan profesional, ramah, menggunakan Bahasa Indonesia yang baik dan profesional.

Konteks:
{context}

Pertanyaan:
{question}

Jawaban:`;

router.post("/", async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) return res.status(400).json({ error: "Pertanyaan kosong." });

    // 1. INSIALISASI Vector Store dari MongoDB Atlas (Bukan lagi dari RAM)
    const vectorstore = await getVectorStore();
    
    if (!vectorstore) {
        return res.status(200).json({ answer: "Sistem database sedang tidak tersedia." });
    }

    const model = new Ollama({
      baseUrl: process.env.OLLAMA_BASE_URL,
      model: process.env.LLM_MODEL, 
      streaming: false, 
    });

    // 2. MODIFIKASI CHAIN: Gunakan vectorstore sebagai retriever
    const chain = ConversationalRetrievalQAChain.fromLLM(
      model,
      vectorstore.asRetriever(6), // Mengambil 6 dokumen paling relevan via Cosine Similarity
      {
        qaTemplate: qaTemplate,
        returnSourceDocuments: true 
      }
    );
    
    // 3. EKSEKUSI: Chat history dikosongkan untuk public chat (stateless)
    const response = await chain.call({ 
        question: question, 
        chat_history: [] 
    });

    res.json({ answer: response.text });

  } catch (err) {
    console.error("❌ [PublicChat] Error:", err);
    res.status(500).json({ answer: "Terjadi kesalahan internal saat memproses jawaban." });
  }
});

export default router;