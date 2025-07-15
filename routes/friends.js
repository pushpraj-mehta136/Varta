const express = require("express");
const fs = require("fs");
const path = require("path");

const FRIENDS_DIR = path.join(__dirname, "../data/friends");
const USERS_DIR = path.join(__dirname, "../data/users");

if (!fs.existsSync(FRIENDS_DIR)) fs.mkdirSync(FRIENDS_DIR, { recursive: true });

// Export a function that takes io and socketIdOf to inject socket.io
module.exports = function(io, socketIdOf) {
  const router = express.Router();

  // ------------------------ Helpers ------------------------

  function getFriendFile(username) {
    return path.join(FRIENDS_DIR, `${username}.json`);
  }

  function getUser(username) {
    const file = path.join(USERS_DIR, `${username}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file));
  }

  function initFriendFile(username) {
    const file = getFriendFile(username);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify({ friends: [], requests: [] }, null, 2));
    }
  }

  // Middleware: require session
  router.use((req, res, next) => {
    if (!req.session?.user?.username) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // ------------------------ APIs ------------------------

  // GET /api/friends - list friends
  router.get("/friends", (req, res) => {
    const user = req.session.user.username;
    initFriendFile(user);
    const { friends } = JSON.parse(fs.readFileSync(getFriendFile(user)));
    const list = friends.map(getUser).filter(Boolean);
    res.json(list);
  });

  // GET /api/friends/requests - list friend requests
  router.get("/friends/requests", (req, res) => {
    const user = req.session.user.username;
    initFriendFile(user);
    const { requests } = JSON.parse(fs.readFileSync(getFriendFile(user)));
    const list = requests.map(getUser).filter(Boolean);
    res.json(list);
  });

  // POST /api/friends/add/:username - send friend request
  router.post("/friends/add/:username", (req, res) => {
    const from = req.session.user.username;
    const to = req.params.username;
    if (from === to) return res.status(400).json({ error: "Cannot add yourself" });

    const toUser = getUser(to);
    if (!toUser) return res.status(404).json({ error: "User not found" });

    initFriendFile(to);
    const toData = JSON.parse(fs.readFileSync(getFriendFile(to)));

    if (toData.friends.includes(from)) {
      return res.status(400).json({ error: "Already friends" });
    }
    if (toData.requests.includes(from)) {
      return res.status(400).json({ error: "Request already sent" });
    }

    toData.requests.push(from);
    fs.writeFileSync(getFriendFile(to), JSON.stringify(toData, null, 2));

    // Emit real-time event to receiver
    const toSocketId = socketIdOf(to);
    if (toSocketId) {
      io.to(toSocketId).emit("friend-request-received", { username: from, fullname: getUser(from)?.fullname || from });
    }

    // Emit real-time event to sender
    const fromSocketId = socketIdOf(from);
    if (fromSocketId) {
      io.to(fromSocketId).emit("friend-request-sent", to);
    }

    res.json({ message: "Friend request sent" });
  });

  // POST /api/friends/cancel/:username - cancel sent friend request
  router.post("/friends/cancel/:username", (req, res) => {
    const from = req.session.user.username;
    const to = req.params.username;

    initFriendFile(to);
    const toData = JSON.parse(fs.readFileSync(getFriendFile(to)));
    toData.requests = toData.requests.filter(u => u !== from);
    fs.writeFileSync(getFriendFile(to), JSON.stringify(toData, null, 2));

    // Emit real-time event to receiver
    const toSocketId = socketIdOf(to);
    if (toSocketId) {
      io.to(toSocketId).emit("friend-request-removed", from);
    }

    // Emit real-time event to sender
    const fromSocketId = socketIdOf(from);
    if (fromSocketId) {
      io.to(fromSocketId).emit("friend-request-canceled", to);
    }

    res.json({ message: "Friend request cancelled" });
  });

  // POST /api/friends/accept/:username - accept friend request
  router.post("/friends/accept/:username", (req, res) => {
    const to = req.session.user.username;
    const from = req.params.username;

    initFriendFile(to);
    initFriendFile(from);

    const toData = JSON.parse(fs.readFileSync(getFriendFile(to)));
    const fromData = JSON.parse(fs.readFileSync(getFriendFile(from)));

    if (!toData.requests.includes(from)) {
      return res.status(400).json({ error: "No request from this user" });
    }

    toData.requests = toData.requests.filter(u => u !== from);

    if (!toData.friends.includes(from)) toData.friends.push(from);
    if (!fromData.friends.includes(to)) fromData.friends.push(to);

    fs.writeFileSync(getFriendFile(to), JSON.stringify(toData, null, 2));
    fs.writeFileSync(getFriendFile(from), JSON.stringify(fromData, null, 2));

    // Emit to both users that request is removed
    const toSocketId = socketIdOf(to);
    const fromSocketId = socketIdOf(from);
    if (toSocketId) io.to(toSocketId).emit("friend-request-removed", from);
    if (fromSocketId) io.to(fromSocketId).emit("friend-request-removed", to);

    // Emit to both users that friend is added
    if (toSocketId) io.to(toSocketId).emit("friend-added", { username: from, fullname: getUser(from)?.fullname || from });
    if (fromSocketId) io.to(fromSocketId).emit("friend-added", { username: to, fullname: getUser(to)?.fullname || to });

    res.json({ message: `Accepted ${from}` });
  });

  // POST /api/friends/reject/:username - reject friend request
  router.post("/friends/reject/:username", (req, res) => {
    const to = req.session.user.username;
    const from = req.params.username;

    initFriendFile(to);
    const toData = JSON.parse(fs.readFileSync(getFriendFile(to)));
    toData.requests = toData.requests.filter(u => u !== from);
    fs.writeFileSync(getFriendFile(to), JSON.stringify(toData, null, 2));

    // Emit to both users that request is removed
    const toSocketId = socketIdOf(to);
    const fromSocketId = socketIdOf(from);
    if (toSocketId) io.to(toSocketId).emit("friend-request-removed", from);
    if (fromSocketId) io.to(fromSocketId).emit("friend-request-removed", to);

    res.json({ message: `Rejected ${from}` });
  });

  // Optionally, add user search here if you want (from your original code)...

  return router;
};
