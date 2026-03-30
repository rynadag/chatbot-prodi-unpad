import mongoose from "mongoose";

const KnowledgeSourceSchema = new mongoose.Schema({
    tag: { type: String, required: true, unique: true },
    content_text: { type: String, required: true },
    last_compiled: { type: Date, default: Date.now },
    embedding: { type: [Number], default: [] } 
});

export default mongoose.model("KnowledgeSource", KnowledgeSourceSchema);
