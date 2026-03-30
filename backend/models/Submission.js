import mongoose from "mongoose";
const { Schema } = mongoose;

const SubmissionSchema = new mongoose.Schema({
  tag: { 
    type: String, 
    required: [true, "Tag wajib diisi"] 
  },
  content_text: { 
    type: String, 
    required: [true, "Teks konten wajib diisi"] 
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'], // Hanya 3 status ini yang diizinkan
    default: 'pending' // Status default saat pertama kali dibuat
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Ini terhubung ke model User.js 
    required: true
  },
  notes: { // Opsional: Untuk admin memberi catatan (misal: "ditolak karena duplikat")
    type: String,
    trim: true
  }
}, {
  timestamps: true // Otomatis menambah 'createdAt' dan 'updatedAt'
});

export default mongoose.model("Submission", SubmissionSchema);