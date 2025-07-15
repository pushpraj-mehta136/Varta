// File: routes/messages.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const messagesPath = path.join(__dirname, "../data/messages.json");

// === Helpers ===
function loadMessages() {
  if (!fs.existsSync(messagesPath)) return {};
  return JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
}

function saveMessages(data) {
  fs.writeFileSync(messagesPath, JSON.stringify(data, null, 2));
}

// === Delete Message for Me ===
router.post("/deleteForMe", (req, res) => {
  const { username, timestamp, roomId } = req.body;
  const data = loadMessages();
  const roomMessages = data[roomId] || [];

  data[roomId] = roomMessages.map(msg => {
    if (msg.timestamp === timestamp) {
      msg.deletedFor = msg.deletedFor || [];
      if (!msg.deletedFor.includes(username)) {
        msg.deletedFor.push(username);
      }
    }
    return msg;
  });

  saveMessages(data);
  res.json({ success: true });
});

// === Delete Message for Both ===
router.post("/deleteForBoth", (req, res) => {
  const { timestamp, roomId } = req.body;
  const data = loadMessages();
  const roomMessages = data[roomId] || [];

  data[roomId] = roomMessages.map(msg => {
    if (msg.timestamp === timestamp) {
      msg.deletedForEveryone = true;
    }
    return msg;
  });

  saveMessages(data);
  res.json({ success: true });
});

module.exports = router;
