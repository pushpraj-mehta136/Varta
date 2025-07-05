// === routes/history.js ===
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const HISTORY_DIR = path.join(__dirname, "../data/history");

// ✅ Middleware: Check user is authenticated
router.use((req, res, next) => {
  if (!req.session?.user?.username) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ✅ GET /history/:user - Get chat history between logged-in user and :user
router.get("/:user", (req, res) => {
  const currentUser = req.session.user.username;
  const otherUser = req.params.user;

  if (!otherUser) {
    return res.status(400).json({ error: "Target user required" });
  }

  const filename = `${[currentUser, otherUser].sort().join("-")}.json`;
  const filePath = path.join(HISTORY_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.json([]); // Return empty chat history if not found
  }

  try {
    const raw = fs.readFileSync(filePath);
    let history = JSON.parse(raw);

    // Ensure all messages have status (for delivery/seen tracking)
    history = history.map(msg => ({
      ...msg,
      status: msg.status || "sent",
    }));

    // Sort messages by timestamp
    history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return res.json(history);
  } catch (err) {
    console.error("❌ Failed to read chat history:", err);
    return res.status(500).json({ error: "Failed to read chat history" });
  }
});

module.exports = router;
