import mongoose from "mongoose";

const KnowledgeSourceSchema = new mongoose.Schema({
    tag:                { type: String, required: true, unique: true, trim: true },
    content_text:       { type: String, required: true, trim: true },
    last_compiled:      { type: Date, default: Date.now },
    embedding:          { type: [Number], default: [] },
    embedding_provider: { type: String, default: null },
    embedding_model:    { type: String, default: null },
    content_hash:       { type: String, default: null },
});

export default mongoose.model("KnowledgeSource", KnowledgeSourceSchema);
