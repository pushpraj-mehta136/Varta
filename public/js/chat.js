import { initReactions, addReactionButton, handleReactionUpdate } from "./reactions.js";

const socket = io();
let myUsername = null;
let currentChat = null;
let chatHistoryCache = {};
let messageStatusMap = {};
let currentPage = 1;
let hasMoreUsers = true;
let loadingUsers = false;

// === TIME UTILITIES ===
async function getServerTimeISO() {
  try {
    const res = await fetch("/api/time");
    const data = await res.json();
    return new Date(data.timestamp).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function formatTime12h(iso) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true
  });
}

// === SOCKET EVENTS ===
socket.on("connect", async () => {
  const res = await fetch("/api/session-user");
  if (!res.ok) return location.href = "/login";
  const data = await res.json();
  myUsername = data.username;

  initReactions(socket, myUsername); // 🔁 Initialize reaction module

  document.getElementById("userAvatar").textContent = myUsername[0].toUpperCase();
  socket.emit("join", myUsername);
  loadFriends();
  loadRequests();
  loadSearch(true);
});

socket.on("active-users", users => {
  document.querySelectorAll(".user-item").forEach(el => {
    el.classList.toggle("online", users.includes(el.dataset.username));
  });
});

socket.on("receive-message", msg => {
  if (msg.from === currentChat) {
    addMessage(msg, msg.status || "delivered");
    socket.emit("seen-messages", { from: msg.from, to: myUsername });
  }
});

socket.on("mark-seen", ({ sender, timestamp }) => {
  if (sender === currentChat) updateStatus(`Seen at ${formatTime12h(timestamp)}`);
  updateMessageStatus(timestamp, "seen");
});

socket.on("message-status-update", ({ timestamp, status }) => {
  updateMessageStatus(timestamp, status);
});

socket.on("reaction-update", handleReactionUpdate);

socket.on("show-typing", ({ from }) => {
  if (from === currentChat) updateStatus("Typing...");
});

socket.on("last-seen", ({ username, lastSeen }) => {
  if (username === currentChat) {
    updateStatus(lastSeen === "Online" ? "Online" : `Last seen at ${formatTime12h(lastSeen)}`);
  }
});

socket.on("refresh-data", ({ type }) => {
  if (type === "friends") loadFriends();
  if (type === "requests") loadRequests();
  if (type === "search") loadSearch(true);
});

// === CHAT FUNCTIONS ===
window.selectChat = async (partner) => {
  currentChat = partner;
  document.getElementById("partnerName").textContent = partner;
  document.getElementById("partnerAvatar").textContent = partner[0].toUpperCase();
  document.getElementById("partnerStatus").textContent = "Loading...";
  document.querySelector(".chat-app").classList.add("chat-open");

  const container = document.getElementById("messages");
  container.innerHTML = "";

  if (chatHistoryCache[partner]) {
    chatHistoryCache[partner].forEach(msg => addMessage(msg, msg.status || "sent"));
    socket.emit("seen-messages", { from: partner, to: myUsername });
    socket.emit("get-last-seen", partner);
    return;
  }

  const res = await fetch(`/history/${partner}`);
  const history = await res.json();
  chatHistoryCache[partner] = history;
  history.forEach(msg => addMessage(msg, msg.status || "sent"));
  socket.emit("seen-messages", { from: partner, to: myUsername });
  socket.emit("get-last-seen", partner);
};

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text || !currentChat) return;

  const timestamp = await getServerTimeISO();
  const msg = { to: currentChat, message: text, timestamp, type: "text" };

  socket.emit("private-message", msg);
  addMessage({ ...msg, from: myUsername }, "sent");
  input.value = "";
}

document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("messageInput").addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});
document.getElementById("messageInput").addEventListener("input", () => {
  if (currentChat) socket.emit("typing", { to: currentChat });
});

// === FILE UPLOAD ===
document.getElementById("fileBtn").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file || !currentChat) return;

  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: form });
  const { fileUrl, originalName } = await res.json();

  const timestamp = await getServerTimeISO();
  const msg = { to: currentChat, message: fileUrl, timestamp, type: "file", originalName };

  socket.emit("private-message", msg);
  addMessage({ ...msg, from: myUsername }, "sent");
});

// === RENDER MESSAGE ===
function addMessage({ from, message, timestamp, type, originalName }, status = "sent") {
  const container = document.getElementById("messages");

  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${from === myUsername ? "outgoing" : "incoming"}`;

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "message-content";

  const bubble = document.createElement("div");
  bubble.className = `message ${from === myUsername ? "outgoing" : "incoming"}`;
  bubble.dataset.timestamp = timestamp;

if (type === "file") {
  const link = document.createElement("a");
  link.href = message;
  link.textContent = originalName || "View File";

  link.onclick = (e) => {
    e.preventDefault();

    const overlay = document.querySelector('.media-overlay');
    const media = document.getElementById('media-content');

    // Set media source
    media.src = link.href;

    // Check if it's an image or something else
    if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(link.href)) {
      media.style.display = "block";
      media.style.maxWidth = "90vw";
      media.style.maxHeight = "80vh";
    } else {
      media.style.display = "none";
      window.open(link.href, '_blank');
      return;
    }

    overlay.style.display = 'flex';
  };

  bubble.appendChild(link);
} else {
  bubble.textContent = message;
}


  const time = document.createElement("div");
  time.className = "timestamp";
  time.dataset.timestamp = timestamp;
  time.style.display = "flex";
  time.style.alignItems = "center";
  time.style.gap = "6px";
  time.style.justifyContent = from === myUsername ? "flex-end" : "flex-start";

  const timeText = document.createElement("span");
  timeText.textContent = formatTime12h(timestamp);

  const statusSpan = document.createElement("span");
  statusSpan.innerHTML = from === myUsername ? getStatusIcon(status) : "";

  time.appendChild(timeText);
  if (from === myUsername) time.appendChild(statusSpan);

  contentWrapper.appendChild(bubble);
  contentWrapper.appendChild(time);
  wrapper.appendChild(contentWrapper);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;

  addReactionButton(bubble, time, timestamp, from === myUsername);

  if (from === myUsername) {
    messageStatusMap[timestamp] = time;
  }
}

function updateMessageStatus(timestamp, status) {
  const el = messageStatusMap[timestamp];
  if (el) {
    const timeText = el.querySelector("span");
    const emojiBtn = el.querySelector(".reaction-emoji-button");
    el.innerHTML = "";
    el.appendChild(timeText);
    if (emojiBtn) el.appendChild(emojiBtn);
    el.insertAdjacentHTML("beforeend", ` ${getStatusIcon(status)}`);
  }
}

function getStatusIcon(status) {
  switch (status) {
    case "sent": return "✓";
    case "delivered": return "✓✓";
    case "seen": return `<i class="fas fa-eye" style="color:white; font-size:1.5em;"></i>`;
    default: return "";
  }
}

function updateStatus(text) {
  const el = document.getElementById("partnerStatus");
  el.textContent = text;
  setTimeout(() => {
    if (currentChat) socket.emit("get-last-seen", currentChat);
  }, 3000);
}

// === FRIENDS ===
async function loadFriends() {
  const res = await fetch("/api/friends");
  const friends = await res.json();
  const pane = document.getElementById("friends");
  pane.innerHTML = friends.length ? "" : "<p class='empty'>No friends yet.</p>";

  friends.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.dataset.username = u.username;
    div.innerHTML = `
      <div class="avatar">${u.username[0].toUpperCase()}</div>
      <div class="info">
        <h4>${u.fullname || u.username}</h4>
        <p>@${u.username}</p>
      </div>`;
    div.onclick = () => selectChat(u.username);
    pane.appendChild(div);
  });
}

// === FRIEND REQUESTS ===
async function loadRequests() {
  const res = await fetch("/api/friends/requests");
  const list = await res.json();
  const pane = document.getElementById("requests");
  pane.innerHTML = list.length ? "" : "<p class='empty'>No pending requests.</p>";

  list.forEach(user => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerHTML = `
      <div class="avatar">${user.username[0].toUpperCase()}</div>
      <div class="info">
        <h4>${user.fullname || user.username}</h4>
        <p>@${user.username}</p>
        <div class="actions">
          <button onclick="accept('${user.username}')">Accept</button>
          <button class="cancel" onclick="reject('${user.username}')">Reject</button>
        </div>
      </div>`;
    pane.appendChild(div);
  });
}

window.accept = async (username) => {
  await fetch(`/api/friends/accept/${username}`, { method: "POST" });
  showToast("success", `Accepted ${username}`);
  socket.emit("refresh-tabs", { type: "requests", target: myUsername });
  socket.emit("refresh-tabs", { type: "friends", target: myUsername });
};

window.reject = async (username) => {
  await fetch(`/api/friends/reject/${username}`, { method: "POST" });
  showToast("info", `Rejected ${username}`);
  socket.emit("refresh-tabs", { type: "requests", target: myUsername });
};

// === GLOBAL SEARCH ===
async function loadSearch(reset = false) {
  if (reset) {
    currentPage = 1;
    hasMoreUsers = true;
    document.getElementById("search").innerHTML = "";
  }
  if (!hasMoreUsers || loadingUsers) return;
  loadingUsers = true;

  const query = document.getElementById("searchUsers").value.trim();
  const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&page=${currentPage}`);
  const users = await res.json();
  if (users.length < 10) hasMoreUsers = false;
  currentPage++;

  const container = document.getElementById("search");
  users.forEach(user => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerHTML = `
      <div class="avatar">${user.username[0].toUpperCase()}</div>
      <div class="info">
        <h4>${user.fullname || user.username}</h4>
        <p>@${user.username}</p>
      </div>
      <div class="actions">
        <button id="btn-${user.username}" onclick="toggleFriendRequest('${user.username}', this)">Add</button>
      </div>`;
    div.onclick = () => previewUser(user);
    container.appendChild(div);
  });

  loadingUsers = false;
}

document.getElementById("search").addEventListener("scroll", e => {
  const el = e.target;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) loadSearch();
});
document.getElementById("searchUsers").addEventListener("input", () => loadSearch(true));

window.toggleFriendRequest = async (username, btn) => {
  const isCancel = btn.textContent === "Cancel";
  const res = await fetch(isCancel ? `/api/friends/cancel/${username}` : `/api/friends/add/${username}`, { method: "POST" });
  const data = await res.json();

  if (res.ok) {
    btn.textContent = isCancel ? "Add" : "Cancel";
    showToast(isCancel ? "info" : "success", data.message);
    socket.emit("refresh-tabs", { type: "search", target: myUsername });
  } else {
    showToast("error", data.error || "Request failed");
  }
};

function previewUser(user) {
  alert(`User: ${user.fullname || user.username}\nUsername: @${user.username}`);
}

// === UI TABS & LOGOUT ===
document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  };
});
document.querySelector(".back-button").onclick = () => {
  document.querySelector(".chat-app").classList.remove("chat-open");
  currentChat = null;
};
document.querySelector(".logout-btn").onclick = async e => {
  e.preventDefault();
  if (confirm("Logout from Vaarta?")) {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  }
};

// === TOASTS ===
function showToast(type, msg) {
  const box = document.querySelector(".toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `${msg}<span class="close-btn" onclick="this.parentElement.remove()">×</span>`;
  box.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
function createToastContainer() {
  const box = document.createElement("div");
  box.className = "toast-container";
  document.body.appendChild(box);
  return box;
}
// === ESCAPE KEY FOR DESKTOP/BROWSER ===
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = document.querySelector('.media-overlay');
    if (overlay && overlay.style.display !== 'none') {
      overlay.style.display = 'none';
    }
  }
});

// === CAPACITOR BACK BUTTON (SAFE WRAPPED) ===
document.addEventListener('DOMContentLoaded', () => {
  if (window.Capacitor && window.Capacitor.isNativePlatform) {
    try {
      const App = window.Capacitor.Plugins.App;

      App.addListener('backButton', () => {
        const mediaOverlay = document.querySelector('.media-overlay');
        if (mediaOverlay && mediaOverlay.style.display !== 'none') {
          mediaOverlay.style.display = 'none';
          return;
        }

        const chatApp = document.querySelector('.chat-app');
        if (chatApp && chatApp.classList.contains('chat-open')) {
          chatApp.classList.remove('chat-open');
          currentChat = null;
          return;
        }

        App.exitApp();
      });
    } catch (err) {
      console.warn("Capacitor backButton listener failed:", err);
    }
  }
});
