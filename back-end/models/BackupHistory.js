import mongoose from "mongoose";

const backupSchema = new mongoose.Schema({
  filename: { 
    type: String, 
    required: true 
  },
  filepath: { 
    type: String, 
    required: true 
  },
  triggeredBy: { 
    type: String, 
    required: true 
  },
  size: {
    type: String, 
  }
}, { timestamps: true });

export default mongoose.model("BackupHistory", backupSchema);
