import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { connectDB } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { ticketsRouter } from "./routes/tickets.js";
import { usersRouter } from "./routes/users.js";
import { profilesRouter } from "./routes/profiles.js";
import { unitsRouter } from "./routes/units.js";
import { departmentsRouter } from "./routes/departments.js";
import { rolesRouter } from "./routes/roles.js";
import { notificationsRouter } from "./routes/notifications.js";
import { ratingsRouter } from "./routes/ratings.js";
import { filesRouter } from "./routes/files.js";

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/users", usersRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/units", unitsRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/ratings", ratingsRouter);
app.use("/api/files", filesRouter);

// Central error handler: surface Zod and known errors as 400s.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.name === "ZodError") {
    return res.status(400).json({ error: "Validation failed", details: err.errors });
  }
  console.error("[error]", err);
  res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal server error" });
});

async function start() {
  await connectDB();
  app.listen(env.PORT, () => console.log(`[server] listening on http://localhost:${env.PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
