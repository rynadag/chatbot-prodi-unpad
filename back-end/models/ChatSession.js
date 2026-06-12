import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    sender:    { type: String, enum: ["USER", "BOT"], required: true },
    msg:       { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const ChatSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    status:    { type: String, enum: ["ACTIVE", "NONACTIVE"], default: "ACTIVE" },
    messages:  [MessageSchema],
}, { timestamps: true });

// Auto-set status NONACTIVE setelah 1 jam tanpa pesan baru
ChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30 hari

export default mongoose.model("ChatSession", ChatSessionSchema);
