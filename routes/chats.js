const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const historyDir = path.resolve(__dirname, "../data/history");

// Helper to extract the "other user" from filename
function getOtherUser(file, currentUser) {
  const base = file.replace(".json", "");
  const parts = base.split("-");
  if (parts.length !== 2) return null;

  const [user1, user2] = parts;
  if (user1 === currentUser) return user2;
  if (user2 === currentUser) return user1;
  return null;
}

router.get("/", async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) {
      console.warn("Unauthorized access to /api/chats");
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("Fetching chats for user:", username);

    if (!fs.existsSync(historyDir)) {
      console.log("History directory does not exist:", historyDir);
      return res.json([]); // No chats yet
    }

    const files = await fs.promises.readdir(historyDir);
    console.log("History files found:", files);

    const chats = [];

    for (const file of files) {
      const otherUser = getOtherUser(file, username);
      if (otherUser) {
        chats.push(otherUser);
      }
    }

    // Remove duplicates just in case
    const uniqueChats = [...new Set(chats)];

    console.log("Chats found:", uniqueChats);

    res.json(uniqueChats);
  } catch (err) {
    console.error("Error in /api/chats:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
