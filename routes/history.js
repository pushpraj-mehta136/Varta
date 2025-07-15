const express = require("express");
const fs = require("fs");
const path = require("path");

const HISTORY_DIR = path.join(__dirname, "../data/history");

function getChatFilePath(userA, userB) {
  return path.join(HISTORY_DIR, `${[userA, userB].sort().join("-")}.json`);
}

module.exports = (io) => {
  const router = express.Router();

  // ✅ Middleware: Ensure user is authenticated
  router.use((req, res, next) => {
    if (!req.session?.user?.username) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // ✅ GET /history/:user → Load chat history with pagination
  router.get("/:user", (req, res) => {
    const me = req.session.user.username;
    const other = req.params.user;
    const page = parseInt(req.query.page || "1");
    const pageSize = parseInt(req.query.pageSize || "20");
    const file = getChatFilePath(me, other);

    if (!fs.existsSync(file)) {
      return res.json({ messages: [], hasMore: false });
    }

    try {
      const rawHistory = JSON.parse(fs.readFileSync(file, "utf-8"));

      // Filter out deleted messages for current user
      const filtered = rawHistory
        .filter(msg => !msg.deletedFor?.includes(me) && msg.deletedFor?.[0] !== "*")
        .map(msg => ({ ...msg, status: msg.status || "sent" }));

      const total = filtered.length;
      const reversed = filtered.slice().reverse(); // newest first
      const start = (page - 1) * pageSize;
      const paginated = reversed.slice(start, start + pageSize).reverse(); // restore old-to-new order

      res.json({
        messages: paginated,
        hasMore: start + pageSize < total
      });
    } catch (err) {
      console.error("❌ Failed to load chat history:", err);
      res.status(500).json({ error: "Failed to load chat history" });
    }
  });

  // ✅ DELETE /history/:user/:id/for-me
  router.delete("/:user/:id/for-me", (req, res) => {
    const me = req.session.user.username;
    const other = req.params.user;
    const id = req.params.id;
    const file = getChatFilePath(me, other);

    if (!fs.existsSync(file)) return res.status(404).json({ error: "Chat file not found" });

    try {
      const history = JSON.parse(fs.readFileSync(file));
      const updated = history.map(msg => {
        if (msg.id === id) {
          msg.deletedFor = msg.deletedFor || [];
          if (!msg.deletedFor.includes(me)) {
            msg.deletedFor.push(me);
          }
        }
        return msg;
      });

      fs.writeFileSync(file, JSON.stringify(updated, null, 2));
      io.to(me).emit("messageDeleted", { id });
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Failed to delete message for me:", err);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // ✅ DELETE /history/:user/:id/for-both
  router.delete("/:user/:id/for-both", (req, res) => {
    const me = req.session.user.username;
    const other = req.params.user;
    const id = req.params.id;
    const file = getChatFilePath(me, other);

    if (!fs.existsSync(file)) return res.status(404).json({ error: "Chat file not found" });

    try {
      const history = JSON.parse(fs.readFileSync(file));
      const updated = history.map(msg => {
        if (msg.id === id && msg.from === me) {
          msg.deletedFor = ["*"];
        }
        return msg;
      });

      fs.writeFileSync(file, JSON.stringify(updated, null, 2));
      io.to(me).emit("messageDeleted", { id });
      io.to(other).emit("messageDeleted", { id });
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Failed to delete message for both:", err);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // ✅ POST /history/:user/:id/undo-for-me
  router.post("/:user/:id/undo-for-me", (req, res) => {
    const me = req.session.user.username;
    const other = req.params.user;
    const id = req.params.id;
    const file = getChatFilePath(me, other);

    if (!fs.existsSync(file)) return res.status(404).json({ error: "Chat file not found" });

    try {
      const history = JSON.parse(fs.readFileSync(file));
      const updated = history.map(msg => {
        if (msg.id === id && msg.deletedFor?.includes(me)) {
          msg.deletedFor = msg.deletedFor.filter(u => u !== me);
          if (msg.deletedFor.length === 0) delete msg.deletedFor;
        }
        return msg;
      });

      fs.writeFileSync(file, JSON.stringify(updated, null, 2));
      io.to(me).emit("messageRestored", { id });
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Failed to undo delete for me:", err);
      res.status(500).json({ error: "Failed to undo delete" });
    }
  });

  // ✅ POST /history/:user/:id/undo-for-both
  router.post("/:user/:id/undo-for-both", (req, res) => {
    const me = req.session.user.username;
    const other = req.params.user;
    const id = req.params.id;
    const file = getChatFilePath(me, other);

    if (!fs.existsSync(file)) return res.status(404).json({ error: "Chat file not found" });

    try {
      const history = JSON.parse(fs.readFileSync(file));
      const updated = history.map(msg => {
        if (msg.id === id && msg.from === me && msg.deletedFor?.[0] === "*") {
          delete msg.deletedFor;
        }
        return msg;
      });

      fs.writeFileSync(file, JSON.stringify(updated, null, 2));
      io.to(me).emit("messageRestored", { id });
      io.to(other).emit("messageRestored", { id });
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Failed to undo delete for both:", err);
      res.status(500).json({ error: "Failed to undo delete" });
    }
  });

  return router;
};
