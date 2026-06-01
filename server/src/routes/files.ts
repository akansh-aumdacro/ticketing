import { Router } from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { getBucket } from "../db.js";
import { requireAuth, asyncHandler } from "../auth/middleware.js";

export const filesRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Upload a file into GridFS; returns a public URL the frontend can store/render.
filesRouter.post(
  "/",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const bucket = getBucket();
    const stream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
      metadata: { uploaded_by: req.user!.sub },
    });
    stream.end(req.file.buffer);
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", reject);
    });
    res.json({ url: `/api/files/${stream.id.toString()}`, name: req.file.originalname });
  })
);

// Stream a file back (public read, matching the old public buckets).
filesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    let oid: ObjectId;
    try {
      oid = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: "Invalid file id" });
    }
    const bucket = getBucket();
    const files = await bucket.find({ _id: oid }).toArray();
    if (!files.length) return res.status(404).json({ error: "File not found" });
    const file = files[0];
    if (file.contentType) res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    bucket.openDownloadStream(oid).on("error", () => res.sendStatus(404)).pipe(res);
  })
);
