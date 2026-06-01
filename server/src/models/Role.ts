import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    permissions: { type: Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

export const Role = mongoose.model("Role", roleSchema);
