// sockets/chatSocket.js
const fs = require("fs");
const path = require("path");

const HISTORY_DIR = path.join(__dirname, "../data/history");
const USERS_DIR = path.join(__dirname, "../data/users");

fs.mkdirSync(HISTORY_DIR, { recursive: true });
fs.mkdirSync(USERS_DIR, { recursive: true });

function saveMessage(from, to, msg) {
  const file = path.join(HISTORY_DIR, `${[from, to].sort().join("-")}.json`);
  const history = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
  history.push(msg);
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
}

function updateMessageStatus(from, to, timestamp, status) {
  const file = path.join(HISTORY_DIR, `${[from, to].sort().join("-")}.json`);
  if (!fs.existsSync(file)) return;
  const history = JSON.parse(fs.readFileSync(file));
  const msg = history.find(m => m.timestamp === timestamp && m.from === from);
  if (msg) {
    msg.status = status;
    fs.writeFileSync(file, JSON.stringify(history, null, 2));
  }
}

function updateMessageReaction(from, to, timestamp, username, emoji) {
  const file = path.join(HISTORY_DIR, `${[from, to].sort().join("-")}.json`);
  if (!fs.existsSync(file)) return;
  const history = JSON.parse(fs.readFileSync(file));
  const msg = history.find(m => m.timestamp === timestamp);
  if (msg) {
    msg.reactions = msg.reactions || {};
    if (emoji) msg.reactions[username] = emoji;
    else delete msg.reactions[username];
    fs.writeFileSync(file, JSON.stringify(history, null, 2));
  }
}

function updateLastSeen(username, iso) {
  const userFile = path.join(USERS_DIR, `${username}.json`);
  const data = fs.existsSync(userFile) ? JSON.parse(fs.readFileSync(userFile)) : {};
  data.lastSeen = iso;
  fs.writeFileSync(userFile, JSON.stringify(data, null, 2));
}

function getLastSeen(username) {
  const userFile = path.join(USERS_DIR, `${username}.json`);
  if (!fs.existsSync(userFile)) return "Offline";
  const data = JSON.parse(fs.readFileSync(userFile));
  return data.lastSeen || "Offline";
}

const sockets = {};
const users = {};
const lastSeen = {};

function getSocketId(username) {
  return sockets[username];
}

function emitTo(username, event, data, io) {
  const socketId = sockets[username];
  if (socketId) io.to(socketId).emit(event, data);
}

function initSockets(io) {
  io.on("connection", (socket) => {
    socket.on("join", (username) => {
      sockets[username] = socket.id;
      users[socket.id] = username;
      lastSeen[username] = "Online";
      io.emit("active-users", Object.keys(sockets));

      const userDir = fs.readdirSync(HISTORY_DIR);
      userDir.forEach(file => {
        const filePath = path.join(HISTORY_DIR, file);
        if (!fs.existsSync(filePath)) return;

        const history = JSON.parse(fs.readFileSync(filePath));
        const pending = history.filter(m => m.to === username && m.status === "sent");
        pending.forEach(msg => {
          msg.status = "delivered";
          updateMessageStatus(msg.from, msg.to, msg.timestamp, "delivered");

          emitTo(msg.from, "message-status-update", {
            timestamp: msg.timestamp,
            status: "delivered"
          }, io);

          emitTo(msg.to, "receive-message", msg, io);
        });

        fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
      });
    });

    socket.on("private-message", ({ to, message, timestamp, type, originalName }) => {
      const from = users[socket.id];
      const msg = {
        from,
        to,
        message,
        timestamp,
        type,
        originalName,
        status: "sent",
        reactions: {}
      };

      saveMessage(from, to, msg);

      if (sockets[to]) {
        msg.status = "delivered";
        updateMessageStatus(from, to, timestamp, "delivered");
        emitTo(to, "receive-message", msg, io);
        emitTo(from, "message-status-update", { timestamp, status: "delivered" }, io);
      } else {
        emitTo(from, "message-status-update", { timestamp, status: "sent" }, io);
      }
    });

    socket.on("react-message", ({ from, to, timestamp, emoji }) => {
      const username = users[socket.id];
      updateMessageReaction(from, to, timestamp, username, emoji);

      emitTo(from, "reaction-update", { timestamp, username, emoji }, io);
      emitTo(to, "reaction-update", { timestamp, username, emoji }, io);
    });

    socket.on("typing", ({ to }) => {
      const from = users[socket.id];
      emitTo(to, "show-typing", { from }, io);
    });

    socket.on("seen-messages", ({ from, to }) => {
      const file = path.join(HISTORY_DIR, `${[from, to].sort().join("-")}.json`);
      if (!fs.existsSync(file)) return;

      const history = JSON.parse(fs.readFileSync(file));
      const lastMessage = [...history].reverse().find(m => m.from === from && m.to === to);
      if (!lastMessage) return;

      updateMessageStatus(from, to, lastMessage.timestamp, "seen");

      emitTo(from, "mark-seen", { sender: to, timestamp: lastMessage.timestamp }, io);
      emitTo(from, "message-status-update", {
        timestamp: lastMessage.timestamp,
        status: "seen"
      }, io);
    });

    socket.on("get-last-seen", (username) => {
      const status = lastSeen[username] === "Online" ? "Online" : getLastSeen(username);
      socket.emit("last-seen", { username, lastSeen: status });
    });

    socket.on("refresh-tabs", ({ type, target }) => {
      emitTo(target, "refresh-data", { type }, io);
    });

    socket.on("disconnect", () => {
      const username = users[socket.id];
      if (username) {
        const timestamp = new Date().toISOString();
        lastSeen[username] = timestamp;
        updateLastSeen(username, timestamp);
        delete sockets[username];
        delete users[socket.id];
        io.emit("active-users", Object.keys(sockets));
      }
    });
  });
}

module.exports = {
  initSockets,
  emitTo,
  getSocketId
};