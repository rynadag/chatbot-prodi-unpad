import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true 
  },
  topicCount: { 
    type: Number, 
    default: 0 
  },
  activeTopicCount: { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

export default mongoose.model("Category", categorySchema);
