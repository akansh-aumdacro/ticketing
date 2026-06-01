import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    unit_id: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    is_active: { type: Boolean, default: true },
  },
  baseOptions
);

export const Department = mongoose.model("Department", departmentSchema);
