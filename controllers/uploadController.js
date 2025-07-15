const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, "../data/uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, unique + "-" + safeName);
  },
});

const upload = multer({ storage });

// Middleware
const requireAuth = (req, res, next) => {
  if (!req.session?.user?.username) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Controller
const uploadHandler = (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    fileUrl,
    originalName: req.file.originalname
  });
};

module.exports = {
  upload,
  requireAuth,
  uploadHandler
};
