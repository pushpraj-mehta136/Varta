const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const FRIENDS_DIR = path.join(__dirname, "../data/friends");

// Ensure friends dir exists
if (!fs.existsSync(FRIENDS_DIR)) fs.mkdirSync(FRIENDS_DIR);

// Helper to get user's friend file
function getFriendFile(username) {
  const file = path.join(FRIENDS_DIR, `${username}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ friends: [], requests: [] }, null, 2));
  return file;
}

// Middleware: require session
router.use((req, res, next) => {
  if (!req.session?.user?.username) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// GET /api/friends
router.get("/friends", (req, res) => {
  const username = req.session.user.username;
  const file = getFriendFile(username);
  const { friends } = JSON.parse(fs.readFileSync(file));
  const userData = friends.map(friend => {
    const fDataPath = path.join(__dirname, "../data/users", `${friend}.json`);
    if (fs.existsSync(fDataPath)) {
      const { username, fullname } = JSON.parse(fs.readFileSync(fDataPath));
      return { username, fullname };
    }
    return { username: friend };
  });
  res.json(userData);
});

// GET /api/friends/requests
router.get("/friends/requests", (req, res) => {
  const username = req.session.user.username;
  const file = getFriendFile(username);
  const { requests } = JSON.parse(fs.readFileSync(file));
  const requestData = requests.map(from => {
    const fDataPath = path.join(__dirname, "../data/users", `${from}.json`);
    if (fs.existsSync(fDataPath)) {
      const { username, fullname } = JSON.parse(fs.readFileSync(fDataPath));
      return { username, fullname };
    }
    return { username: from };
  });
  res.json(requestData);
});

// POST /api/friends/add/:username
router.post("/friends/add/:username", (req, res) => {
  const from = req.session.user.username;
  const to = req.params.username;
  if (from === to) return res.status(400).json({ error: "Cannot add yourself" });

  const toFile = getFriendFile(to);
  const toData = JSON.parse(fs.readFileSync(toFile));

  if (toData.friends.includes(from)) return res.status(400).json({ error: "Already friends" });
  if (toData.requests.includes(from)) return res.status(400).json({ error: "Request already sent" });

  toData.requests.push(from);
  fs.writeFileSync(toFile, JSON.stringify(toData, null, 2));
  res.json({ message: "Friend request sent" });
});

// POST /api/friends/cancel/:username
router.post("/friends/cancel/:username", (req, res) => {
  const from = req.session.user.username;
  const to = req.params.username;

  const toFile = getFriendFile(to);
  const toData = JSON.parse(fs.readFileSync(toFile));

  toData.requests = toData.requests.filter(u => u !== from);
  fs.writeFileSync(toFile, JSON.stringify(toData, null, 2));
  res.json({ message: "Friend request cancelled" });
});

// POST /api/friends/accept/:username
router.post("/friends/accept/:username", (req, res) => {
  const to = req.session.user.username;
  const from = req.params.username;

  const toFile = getFriendFile(to);
  const fromFile = getFriendFile(from);

  const toData = JSON.parse(fs.readFileSync(toFile));
  const fromData = JSON.parse(fs.readFileSync(fromFile));

  if (!toData.requests.includes(from)) {
    return res.status(400).json({ error: "No request from this user" });
  }

  // Remove request
  toData.requests = toData.requests.filter(u => u !== from);

  // Add each other as friends
  if (!toData.friends.includes(from)) toData.friends.push(from);
  if (!fromData.friends.includes(to)) fromData.friends.push(to);

  fs.writeFileSync(toFile, JSON.stringify(toData, null, 2));
  fs.writeFileSync(fromFile, JSON.stringify(fromData, null, 2));

  res.json({ message: `Accepted ${from}` });
});

// POST /api/friends/reject/:username
router.post("/friends/reject/:username", (req, res) => {
  const to = req.session.user.username;
  const from = req.params.username;

  const toFile = getFriendFile(to);
  const toData = JSON.parse(fs.readFileSync(toFile));

  toData.requests = toData.requests.filter(u => u !== from);
  fs.writeFileSync(toFile, JSON.stringify(toData, null, 2));

  res.json({ message: `Rejected ${from}` });
});

module.exports = router;
