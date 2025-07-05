// === routes/users.js ===

const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const USERS_DIR = path.join(__dirname, "../data/users");
const FRIENDS_DIR = path.join(__dirname, "../data/friends");

// ✅ Global auth protection for all routes
router.use(requireAuth);

// ✅ GET /api/users/search?q=...
router.get("/search", (req, res) => {
  try {
    const currentUser = req.session.user.username;
    const query = req.query.q?.toLowerCase() || "";

    // 🔒 Exclude self, friends, and pending requests
    const excludedUsers = new Set([currentUser]);
    const friendFile = path.join(FRIENDS_DIR, `${currentUser}.json`);

    if (fs.existsSync(friendFile)) {
      const { friends = [], requests = [] } = JSON.parse(fs.readFileSync(friendFile, "utf-8"));
      [...friends, ...requests].forEach(u => excludedUsers.add(u));
    }

    // 📦 Load all users from /data/users
    let users = fs.readdirSync(USERS_DIR)
      .map(file => {
        try {
          return JSON.parse(fs.readFileSync(path.join(USERS_DIR, file), "utf-8"));
        } catch (err) {
          console.warn("Failed to parse:", file);
          return null;
        }
      })
      .filter(user =>
        user &&
        !excludedUsers.has(user.username) &&
        (user.fullname || user.avatar) // filter out incomplete profiles
      );

    // 🔍 Apply search or "random"
    if (query === "random") {
      users = users.sort(() => Math.random() - 0.5).slice(0, 10);
    } else if (query) {
      users = users.filter(user =>
        user.username.toLowerCase().includes(query) ||
        user.fullname?.toLowerCase().includes(query)
      );
    }

    // 🎯 Send search results
    res.json(users);
  } catch (err) {
    console.error("Error in /search:", err);
    res.status(500).json({ error: "Failed to search users." });
  }
});

module.exports = router;
