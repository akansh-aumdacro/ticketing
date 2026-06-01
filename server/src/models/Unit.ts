import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const unitSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  baseOptions
);

export const Unit = mongoose.model("Unit", unitSchema);
