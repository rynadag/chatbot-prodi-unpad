import mongoose from "mongoose";
const { Schema } = mongoose;

const SubmissionSchema = new mongoose.Schema({
    tag: {
        type: String,
        required: [true, "Tag wajib diisi"],
        trim: true,
    },
    content_text: {
        type: String,
        required: [true, "Teks konten wajib diisi"],
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
    },
    submittedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    notes: {
        type: String,
        trim: true,
    },
}, { timestamps: true });

export default mongoose.model("Submission", SubmissionSchema);
