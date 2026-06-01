import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { AppRole } from "../models/_base.js";

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: AppRole;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
