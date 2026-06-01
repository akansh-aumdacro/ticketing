import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { env } from "./env.js";

let bucket: GridFSBucket | null = null;

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo connection has no database handle");
  bucket = new GridFSBucket(db, { bucketName: "attachments" });
  console.log(`[db] connected to ${env.MONGODB_URI}`);
}

export function getBucket(): GridFSBucket {
  if (!bucket) throw new Error("GridFS bucket not initialised — call connectDB() first");
  return bucket;
}
