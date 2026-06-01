import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const env = {
  MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/ticketing",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-me",
  PORT: Number(process.env.PORT ?? 3001),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:8080",
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL ?? "admin@ticketing.local",
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD ?? "admin123",
  SUPER_ADMIN_NAME: process.env.SUPER_ADMIN_NAME ?? "Super Admin",
};