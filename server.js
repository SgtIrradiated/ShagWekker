const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const ROOT_DIR = __dirname;
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const sanitizeFilename = name => {
  return name
    .replace(/[\s]+/g, "-")
    .replace(/[^a-zA-Z0-9.\-\_]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 180);
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const cleaned = sanitizeFilename(file.originalname || "upload");
    const parsed = path.parse(cleaned);
    const baseName = parsed.name || "upload";
    const ext = parsed.ext || "";

    let attempt = 0;
    let candidate = `${baseName}${ext}`;
    while (fs.existsSync(path.join(UPLOAD_DIR, candidate))) {
      attempt += 1;
      candidate = `${baseName}-${attempt}${ext}`;
    }

    cb(null, candidate);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB per bestand
    files: 25
  }
});

app.use(express.static(ROOT_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

const mapFile = async fileName => {
  const filePath = path.join(UPLOAD_DIR, fileName);
  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      return null;
    }

    return {
      name: fileName,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      url: `/uploads/${encodeURIComponent(fileName)}`
    };
  } catch (_error) {
    return null;
  }
};

app.get("/api/files", async (_req, res, next) => {
  try {
    const entries = await fs.promises.readdir(UPLOAD_DIR);
    const mapped = await Promise.all(entries.map(mapFile));
    const files = mapped.filter(Boolean).sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json({ files });
  } catch (error) {
    next(error);
  }
});

app.post("/api/upload", upload.array("files", 25), async (req, res, next) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: "Geen bestanden ontvangen" });
    }

    const files = await Promise.all(req.files.map(file => mapFile(file.filename)));
    res.status(201).json({ files: files.filter(Boolean) });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Bestand is groter dan 50 MB" });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: "Te veel bestanden geselecteerd" });
    }
    return res.status(400).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: "Onverwachte fout op de server" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ShagWekker server running on http://localhost:${PORT}`);
});
