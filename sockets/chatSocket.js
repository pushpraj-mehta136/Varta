const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HISTORY_DIR = path.join(__dirname, "../data/history");
const USERS_DIR = path.join(__dirname, "../data/users");

fs.mkdirSync(HISTORY_DIR, { recursive: true });
fs.mkdirSync(USERS_DIR, { recursive: true });

const sockets = {};
const users = {};
const lastSeen = {};
const lastPing = {};

// === FILE HELPERS ===
function getChatFile(from, to) {
  return path.join(HISTORY_DIR, `${[from, to].sort().join("-")}.json`);
}

function loadChatHistory(from, to) {
  const file = getChatFile(from, to);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

function saveChatHistory(from, to, history) {
  const file = getChatFile(from, to);
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
}

function saveMessage(from, to, msg) {
  msg.id = msg.id || crypto.randomUUID();
  const history = loadChatHistory(from, to);
  history.push(msg);
  saveChatHistory(from, to, history);
}

function updateMessage(from, to, id, cb) {
  const history = loadChatHistory(from, to);
  const idx = history.findIndex(m => m.id === id);
  if (idx === -1) return;
  cb(history[idx]);
  saveChatHistory(from, to, history);
}

function updateMessageStatus(from, to, id, status) {
  updateMessage(from, to, id, msg => { msg.status = status; });
}

function updateMessageReaction(from, to, id, user, emoji) {
  updateMessage(from, to, id, msg => {
    msg.reactions = msg.reactions || {};
    if (emoji) msg.reactions[user] = emoji;
    else delete msg.reactions[user];
  });
}

function getMessageReactions(from, to, id) {
  const history = loadChatHistory(from, to);
  const msg = history.find(m => m.id === id);
  return msg?.reactions || {};
}

function updateLastSeen(username, iso) {
  const file = path.join(USERS_DIR, `${username}.json`);
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
  data.lastSeen = iso;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getLastSeen(username) {
  try {
    const file = path.join(USERS_DIR, `${username}.json`);
    if (!fs.existsSync(file)) return "Offline";
    return JSON.parse(fs.readFileSync(file)).lastSeen || "Offline";
  } catch {
    return "Offline";
  }
}

// === EMIT HELPERS ===
function emitTo(username, event, data, io) {
  const id = sockets[username];
  if (id) io.to(id).emit(event, data);
}

function refreshTabs(users, types, io) {
  for (const user of users) {
    for (const type of types) {
      emitTo(user, "refresh-tabs", { type }, io);
    }
  }
}

// === SOCKET SETUP ===
function initSockets(io) {
  io.on("connection", socket => {
    socket.on("join", username => {
      sockets[username] = socket.id;
      users[socket.id] = username;
      lastSeen[username] = "Online";
      lastPing[username] = Date.now();

      io.emit("presence-update", { username, status: "Online" });
      io.emit("active-users", Object.keys(sockets));

      // Deliver all pending messages
      fs.readdirSync(HISTORY_DIR).forEach(file => {
        const filePath = path.join(HISTORY_DIR, file);
        const history = JSON.parse(fs.readFileSync(filePath));
        let changed = false;

        history.forEach(msg => {
          if (msg.to === username && msg.status === "sent") {
            msg.status = "delivered";
            emitTo(username, "receive-message", msg, io);
            emitTo(msg.from, "message-status-update", { id: msg.id, status: "delivered" }, io);
            changed = true;
          }
        });

        if (changed) {
          fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
        }
      });
    });

    socket.on("ping-status", () => {
      const username = users[socket.id];
      if (username) {
        lastSeen[username] = "Online";
        lastPing[username] = Date.now();
        io.emit("presence-update", { username, status: "Online" });
      }
    });

    socket.on("private-message", (msg, cb) => {
      const from = users[socket.id];
      if (!from || !msg.to) return;

      msg.id = msg.id || crypto.randomUUID();
      msg.from = from;
      msg.status = "sent";
      msg.reactions = {};
      msg.timestamp = new Date().toISOString();

      saveMessage(from, msg.to, msg);

      const toId = sockets[msg.to];
      const isOnline = toId && io.sockets.sockets.get(toId)?.connected;

      if (isOnline) {
        emitTo(msg.to, "receive-message", msg, io);
        updateMessageStatus(from, msg.to, msg.id, "delivered");
        emitTo(from, "message-status-update", { id: msg.id, status: "delivered" }, io);
        cb?.("ok");
      } else {
        emitTo(from, "message-status-update", { id: msg.id, status: "sent" }, io);
        cb?.("sent");
      }

      refreshTabs([from, msg.to], ["chats"], io);
    });

    socket.on("react-message", ({ to, id, emoji }) => {
      const from = users[socket.id];
      if (!from) return;
      updateMessageReaction(from, to, id, from, emoji);
      const reactions = getMessageReactions(from, to, id);
      const payload = { id, username: from, emoji, reactions };
      emitTo(to, "reaction-update", payload, io);
      emitTo(from, "reaction-update", payload, io);
    });

    socket.on("typing", ({ to }) => {
      const from = users[socket.id];
      if (from && to) emitTo(to, "show-typing", { from }, io);
    });

    socket.on("stop-typing", ({ to }) => {
      const from = users[socket.id];
      if (from && to) emitTo(to, "hide-typing", { from }, io);
    });

socket.on("seen-messages", ({ from, to }) => {
  // to = the viewer (e.g., the one who just opened the chat)
  // from = sender of messages (i.e., the chat partner)

  const history = loadChatHistory(from, to); // correct since loadChatHistory sorts names internally
  let updated = false;
  const seenIds = [];

  for (const msg of history) {
    if (msg.from === from && msg.to === to && msg.status !== "seen") {
      msg.status = "seen";
      seenIds.push(msg.id);
      updated = true;
    }
  }

  if (updated) {
    saveChatHistory(from, to, history);

    // 🔁 Update all seen messages in bulk to the sender
    emitTo(from, "mark-seen", { sender: to, seenIds }, io);

    // Update status bubbles in sender's view
    for (const id of seenIds) {
      emitTo(from, "message-status-update", { id, status: "seen" }, io);
    }

    // Optional: update sender's chat list preview
    refreshTabs([from], ["chats"], io);
  }
});



    socket.on("get-last-seen", username => {
      const status = lastSeen[username] === "Online" ? "Online" : getLastSeen(username);
      socket.emit("last-seen", { username, lastSeen: status });
    });

    socket.on("disconnect", () => {
      const username = users[socket.id];
      if (username) {
        const iso = new Date().toISOString();
        updateLastSeen(username, iso);
        lastSeen[username] = iso;
        delete sockets[username];
        delete users[socket.id];
        delete lastPing[username];
        io.emit("presence-update", { username, status: iso });
        io.emit("active-users", Object.keys(sockets));
      }
    });

    socket.on("delete-for-me", ({ peer, id }) => {
      updateMessage(peer, users[socket.id], id, msg => {
        msg.deletedFor = msg.deletedFor || [];
        if (!msg.deletedFor.includes(users[socket.id])) {
          msg.deletedFor.push(users[socket.id]);
        }
      });
    });

    socket.on("delete-for-both", ({ peer, id }) => {
      updateMessage(users[socket.id], peer, id, msg => {
        const diff = Date.now() - new Date(msg.timestamp).getTime();
        if (msg.from === users[socket.id] && diff <= 86400000) {
          msg.deletedFor = ["*"];
        }
      });
      refreshTabs([users[socket.id], peer], ["chats"], io);
    });

    socket.on("undo-for-me", ({ peer, id }) => {
      updateMessage(peer, users[socket.id], id, msg => {
        if (msg.deletedFor?.includes(users[socket.id])) {
          msg.deletedFor = msg.deletedFor.filter(u => u !== users[socket.id]);
          if (msg.deletedFor.length === 0) delete msg.deletedFor;
        }
      });
    });

    socket.on("undo-for-both", ({ peer, id }) => {
      updateMessage(users[socket.id], peer, id, msg => {
        if (msg.deletedFor?.[0] === "*") delete msg.deletedFor;
      });
      refreshTabs([users[socket.id], peer], ["chats"], io);
    });

    socket.on("refresh-tabs", ({ type, target }) => {
      emitTo(target, "refresh-tabs", { type }, io);
    });
  });

  // Auto-mark users offline if not pinging
  setInterval(() => {
    const now = Date.now();
    for (const username in lastPing) {
      if (now - lastPing[username] > 7000) {
        const iso = new Date().toISOString();
        updateLastSeen(username, iso);
        lastSeen[username] = iso;
        delete lastPing[username];
        io.emit("presence-update", { username, status: iso });
      }
    }
  }, 3000);
}

module.exports = {
  initSockets,
  emitTo,
  getSocketId: username => sockets[username],
  refreshTabs
};
