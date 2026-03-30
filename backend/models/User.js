// File: backend/models/User.js

import mongoose from "mongoose";
import bcrypt from "bcrypt";

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, "Email wajib diisi"], 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, "Password wajib diisi"] 
  },
  role: {
    type: String,
    enum: ['admin', 'user'], // Hanya boleh 'admin' atau 'user'
    default: 'user' // Akun baru otomatis menjadi 'user'
  }
}, {
  timestamps: true 
});

// Hash password secara otomatis sebelum disimpan
UserSchema.pre('save', async function(next) {
  // Hanya hash password jika baru dibuat atau diubah
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method untuk membandingkan password saat login
UserSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", UserSchema);