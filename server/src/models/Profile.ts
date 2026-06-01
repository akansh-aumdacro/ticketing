import mongoose, { Schema } from "mongoose";
import { baseOptions } from "./_base.js";

const profileSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    name: { type: String, required: true },
    username: { type: String, default: null },
    employee_id: { type: String, default: null },
    department_id: { type: Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    unit_id: { type: Schema.Types.ObjectId, ref: "Unit", default: null, index: true },
    contact: { type: String, default: null },
    avatar_url: { type: String, default: null },
  },
  baseOptions
);

export const Profile = mongoose.model("Profile", profileSchema);
