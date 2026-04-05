/**
 * chatHelper.js
 * Fungsi shared untuk memproses pertanyaan chatbot.
 * Digunakan oleh chat.js (authenticated) dan publicChat.js (public).
 */
import { Ollama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { getVectorStore } from "./ragHelper.js";

const QA_TEMPLATE = `Anda adalah asisten virtual khusus untuk Program Studi Magister Ilmu Manajemen (MIM) FEB Unpad.

INSTRUKSI PENTING:
Langkah 1: Analisis topik pertanyaan pengguna.
- Jika pertanyaan bersifat UMUM atau TIDAK BERHUBUNGAN dengan akademik/kampus, JAWABLAH: "Maaf, saya hanya dapat membantu menjawab pertanyaan seputar informasi akademik dan administrasi Program Studi MIM FEB Unpad."

Langkah 2: Jika pertanyaan BERHUBUNGAN dengan akademik/kampus, periksa Konteks di bawah.
- Jika jawaban TIDAK DITEMUKAN di dalam Konteks, JAWABLAH: "Mohon maaf, informasi spesifik mengenai hal tersebut belum tersedia di dalam database kami. Untuk informasi lebih lanjut, silakan hubungi Helpdesk Akademik FEB Unpad."
- Jika jawaban ADA di Konteks, jawablah dengan profesional, ramah, dan menggunakan Bahasa Indonesia yang baik.

Konteks:
{context}

Pertanyaan:
{question}

Jawaban:`;

let llmInstance = null;

function getLLM() {
    if (!llmInstance) {
        llmInstance = new Ollama({
            baseUrl: process.env.OLLAMA_BASE_URL,
            model: process.env.LLM_MODEL,
        });
    }
    return llmInstance;
}

/**
 * Memproses pertanyaan menggunakan RAG (Retrieval-Augmented Generation).
 * Menggunakan LCEL (LangChain Expression Language) — lebih ringan dan modern
 * dibanding ConversationalRetrievalQAChain yang sudah deprecated.
 *
 * @param {string} question - Pertanyaan dari pengguna
 * @returns {Promise<string>} - Jawaban dari model
 */
export async function processQuestion(question) {
    const vectorStore = await getVectorStore();

    if (!vectorStore) {
        return "Sistem database sedang tidak tersedia. Silakan coba beberapa saat lagi.";
    }

    const retriever = vectorStore.asRetriever({ k: 6 });
    const prompt = PromptTemplate.fromTemplate(QA_TEMPLATE);
    const llm = getLLM();

    // Bangun chain dengan LCEL — ringan, tidak ada overhead deprecated chain
    const chain = RunnableSequence.from([
        {
            context: async (input) => {
                const docs = await retriever.invoke(input.question);
                return docs.map(d => d.pageContent).join("\n\n");
            },
            question: new RunnablePassthrough().pipe(input => input.question),
        },
        prompt,
        llm,
        new StringOutputParser(),
    ]);

    const raw = await chain.invoke({ question });

    const answer = raw
        .replace(/\n*Dengan demikian,.*/s, "")
        .replace(/\n*Jadi,.*/s, "")
        .replace(/\n*Kesimpulannya,.*/s, "")
        .trim();

    return answer;
}
