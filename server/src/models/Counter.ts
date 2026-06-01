import mongoose, { Schema } from "mongoose";

// Atomic sequence generator (used for per-year ticket numbers).
const counterSchema = new Schema({
  _id: { type: String, required: true }, // e.g. "ticket-2026"
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model("Counter", counterSchema);
