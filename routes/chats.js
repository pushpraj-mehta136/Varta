const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const historyDir = path.resolve(__dirname, "../data/history");

// Get consistent file path for chat history
function getChatFile(user1, user2) {
  const sorted = [user1, user2].sort();
  return path.join(historyDir, `${sorted[0]}-${sorted[1]}.json`);
}

// Get the other participant from filename
function getOtherUser(file, currentUser) {
  const parts = file.replace(".json", "").split("-");
  if (parts.length !== 2) return null;
  return parts[0] === currentUser ? parts[1] : (parts[1] === currentUser ? parts[0] : null);
}

// === GET /api/chats - Chat summaries for sidebar ===
router.get("/", async (req, res) => {
  const username = req.session?.user?.username;
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (!fs.existsSync(historyDir)) return res.json([]);

    const files = await fs.promises.readdir(historyDir);
    const chatSummaries = [];

    for (const file of files) {
      const otherUser = getOtherUser(file, username);
      if (!otherUser) continue;

      const filePath = path.join(historyDir, file);
      const history = JSON.parse(await fs.promises.readFile(filePath, "utf-8"));
      if (!Array.isArray(history) || history.length === 0) continue;

      // ✅ Count unread messages (safe fallback for missing "status")
      const unread = history.filter(
        msg =>
          msg.to === username &&
          msg.from === otherUser &&
          (!msg.status || msg.status !== "seen") &&
          !msg.deletedFor?.includes(username)
      ).length;

      // ✅ Get last visible message (not deleted for this user)
      const lastVisible = [...history].reverse().find(
        msg =>
          !msg.deletedFor?.includes(username) &&
          (msg.from === username || msg.to === username)
      );

      chatSummaries.push({
        username: otherUser,
        lastMessage: lastVisible?.type === "file" ? "📎 File" : lastVisible?.message || "",
        timestamp: lastVisible?.timestamp || "",
        unread
      });
    }

    // Sort by latest message time
    chatSummaries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(chatSummaries);
  } catch (err) {
    console.error("Error loading chats:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// === POST /api/chats/mark-seen/:username ===
router.post("/mark-seen/:username", async (req, res) => {
  const currentUser = req.session?.user?.username;
  const otherUser = req.params.username;
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const chatFile = getChatFile(currentUser, otherUser);
  if (!fs.existsSync(chatFile)) return res.json({ message: "No chat file found" });

  try {
    const history = JSON.parse(await fs.promises.readFile(chatFile, "utf-8"));
    let updated = false;

    for (const msg of history) {
      if (
        msg.to === currentUser &&
        msg.from === otherUser &&
        (!msg.status || msg.status !== "seen")
      ) {
        msg.status = "seen";
        updated = true;
      }
    }

    if (updated) {
      await fs.promises.writeFile(chatFile, JSON.stringify(history, null, 2), "utf-8");

      // ✅ Notify sender to refresh chats sidebar
      const io = req.app.get("io");
      if (io) {
        for (const [id, socket] of io.of("/").sockets) {
          if (socket.username === otherUser) {
            socket.emit("refresh-chats");
          }
        }
      }
    }

    res.json({ message: "Messages marked as seen" });
  } catch (err) {
    console.error("Error marking messages as seen:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
