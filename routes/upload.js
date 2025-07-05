const express = require("express");
const multer = require("multer");
const path = require("path");

const UPLOADS_DIR = path.join(__dirname, "../data/uploads");

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});

const upload = multer({ storage });
const router = express.Router();

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  res.json({
    fileUrl: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname
  });
});

module.exports = router;
