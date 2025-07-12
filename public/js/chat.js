import { initReactions, addReactionButton, handleReactionUpdate, renderReactions } from "./reactions.js";
import { setMyUsername, showMenuPopup } from "./menu.js";

const onlineUsers = new Set();
const lastSeenMap = {};        
const socket = io();
let myUsername = null;
let currentChat = null;
let chatHistoryCache = {};
let messageStatusMap = {};
let isTyping = false;
let typingDebounce = null;
let statusRestoreTimeout = null; // ✅ Prevents ReferenceError
const STOP_TYPING_DELAY = 3000;

// === TIME UTILS ===
async function getServerTimeISO() {
  try {
    const res = await fetch("/api/time", { credentials: "include" });
    const data = await res.json();
    return new Date(data.timestamp).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function formatTime12h(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function formatLastSeen(iso) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (sameDay) return `Last seen today at ${formatTime12h(iso)}`;
  if (diffDays === 1) return `Last seen yesterday at ${formatTime12h(iso)}`;
  if (diffDays <= 6) return `Last seen ${date.toLocaleDateString("en-US", { weekday: "long" })} at ${formatTime12h(iso)}`;
  return `Last seen on ${date.toLocaleDateString()} at ${formatTime12h(iso)}`;
}

// === SOCKET INIT ===
socket.on("connect", async () => {
  const res = await fetch("/api/session-user", { credentials: "include" });
  if (!res.ok) return location.href = "/login";
  const data = await res.json();
  myUsername = data.username;
  setMyUsername(myUsername);
  initReactions(socket, myUsername);
  document.getElementById("userAvatar").textContent = myUsername[0].toUpperCase();
  socket.emit("join", myUsername);

  // Load all sidebar tabs
  loadChats?.(); // ✅ ADD THIS
  loadFriends?.();
  loadRequests?.();
  loadSearch?.(true);
});

socket.on("active-users", users => {
  onlineUsers.clear();
  users.forEach(u => onlineUsers.add(u));

  // Update sidebar online status
  document.querySelectorAll(".user-item").forEach(el => {
    const username = el.dataset.username;
    el.classList.toggle("online", onlineUsers.has(username));
  });

  // Update chat header if user is active
  if (currentChat && onlineUsers.has(currentChat)) {
    updateStatus("Online");
  }
});

socket.on("receive-message", msg => {
  if (msg.from === currentChat && !isMessageDeletedForMe(msg)) {
    addMessage(msg, msg.status || "sent");
    socket.emit("seen-messages", { from: msg.from, to: myUsername });
  }
});

socket.on("mark-seen", ({ sender, timestamp }) => {
  if (sender === currentChat) updateMessageStatus(timestamp, "seen");
});

socket.on("message-status-update", ({ id, status }) => {
  updateMessageStatus(id, status);
});

socket.on("reaction-update", data => {
  handleReactionUpdate(data, myUsername);
  requestAnimationFrame(() => {
    const bubble = document.querySelector(`.message[data-id="${data.id}"]`);
    if (bubble) {
      const reactionBox = bubble.querySelector(".reaction-box");
      if (reactionBox) renderReactions(reactionBox, data.reactions);
    }
  });
});

socket.on("show-typing", ({ from }) => {
  if (from !== currentChat) return;
  clearTimeout(statusRestoreTimeout);
  updateStatus("Typing...");

  // ⏱ Force fallback in 2s
  statusRestoreTimeout = setTimeout(() => {
    socket.emit("get-last-seen", from);
  }, 2000);
});

socket.on("hide-typing", ({ from }) => {
  if (from !== currentChat) return;

  clearTimeout(statusRestoreTimeout);
  // Restore status after short delay to prevent flicker
  statusRestoreTimeout = setTimeout(() => {
    if (onlineUsers.has(from)) {
      updateStatus("Online");
    } else if (lastSeenMap[from]) {
      updateStatus(formatLastSeen(lastSeenMap[from]));
    } else {
      updateStatus("Offline");
    }
  }, 500);
});

socket.on("last-seen", ({ username, lastSeen }) => {
  if (username === currentChat) {
    if (lastSeen === "Online" || onlineUsers.has(username)) {
      updateStatus("Online");
    } else {
      lastSeenMap[username] = lastSeen;
      updateStatus(formatLastSeen(lastSeen));
    }
  }
});

socket.on("refresh-data", ({ type }) => {
  if (type === "friends") loadFriends?.();
  if (type === "requests") loadRequests?.();
  if (type === "search") loadSearch?.(true);
});

// === SELECT CHAT ===
window.selectChat = async (partner) => {
  currentChat = partner;
  document.getElementById("partnerName").textContent = partner;
  document.getElementById("partnerAvatar").textContent = partner[0].toUpperCase();
if (onlineUsers.has(partner)) {
  document.getElementById("partnerStatus").textContent = "Online";
} else if (lastSeenMap[partner]) {
  document.getElementById("partnerStatus").textContent = formatLastSeen(lastSeenMap[partner]);
} else {
  document.getElementById("partnerStatus").textContent = "Loading...";
}
  document.querySelector(".chat-app").classList.add("chat-open");

  const container = document.getElementById("messages");
  container.innerHTML = "";

  try {
    const res = await fetch(`/history/${partner}`, { credentials: "include" });
    const history = await res.json();
    chatHistoryCache[partner] = history;

    history.forEach(msg => {
      if (!isMessageDeletedForMe(msg)) {
        addMessage(msg, msg.status || "sent");
      }
    });

    scrollToBottom();
    socket.emit("seen-messages", { from: partner, to: myUsername });
    socket.emit("get-last-seen", partner);
  } catch (err) {
    console.error("Failed to load history:", err);
  }
};

function scrollToBottom() {
  requestAnimationFrame(() => {
    const container = document.getElementById("messages");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
}

// === INPUT & TYPING LOGIC ===
const inputEl = document.getElementById("messageInput");

inputEl.addEventListener("input", () => {
  if (!currentChat) return;

  const text = inputEl.value.trim();

  if (text && !isTyping) {
    socket.emit("typing", { to: currentChat });
    isTyping = true;
  }

  if (!text && isTyping) {
    socket.emit("stop-typing", { to: currentChat });
    isTyping = false;
    clearTimeout(typingDebounce);
    return;
  }

  clearTimeout(typingDebounce);
  typingDebounce = setTimeout(() => {
    if (isTyping) {
      socket.emit("stop-typing", { to: currentChat });
      isTyping = false;
    }
  }, STOP_TYPING_DELAY);
});

// === SEND MESSAGE ===
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || !currentChat) return;

  try {
    const timestamp = await getServerTimeISO();
    const id = crypto.randomUUID();
    const msg = { id, to: currentChat, message: text, timestamp, type: "text" };

    socket.emit("private-message", msg);
    addMessage({ ...msg, from: myUsername }, "sent");
    inputEl.value = "";

    // Stop typing immediately
    if (isTyping) {
      socket.emit("stop-typing", { to: currentChat });
      isTyping = false;
      clearTimeout(typingDebounce);
    }
  } catch (err) {
    console.error("Message send failed:", err);
  }
}

// === BIND EVENTS ===
document.getElementById("sendBtn").onclick = sendMessage;

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// === FILE UPLOAD ===
document.getElementById("fileBtn").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file || !currentChat) return;

  const form = new FormData();
  form.append("file", file);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: form,
      credentials: "include"
    });
    const { fileUrl, originalName } = await res.json();
    const timestamp = await getServerTimeISO();
    const id = crypto.randomUUID(); // ✅ Generate ID for file message

    const msg = { id, to: currentChat, message: fileUrl, timestamp, type: "file", originalName };
    socket.emit("private-message", msg);
    addMessage({ ...msg, from: myUsername }, "sent");
  } catch (err) {
    console.error("File upload failed:", err);
  }
});

// === RENDER MESSAGE ===
function addMessage({ id, from, message, timestamp, type, originalName, reactions = {} }, status = "sent") {
  const container = document.getElementById("messages");
  if (!container) return;

  const isOutgoing = from === myUsername;
  const toUser = isOutgoing ? currentChat : from;

  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${isOutgoing ? "outgoing" : "incoming"}`;

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "message-content";

  const bubble = document.createElement("div");
  bubble.className = `message ${isOutgoing ? "outgoing" : "incoming"}`;
  bubble.dataset.timestamp = timestamp;
  bubble.dataset.id = id; // ✅ Attach message ID

  if (type === "file") {
    const link = document.createElement("a");
    link.href = message;
    link.textContent = originalName || "View File";
    link.onclick = (e) => {
      e.preventDefault();
      const overlay = document.querySelector(".media-overlay");
      const media = document.getElementById("media-content");
      media.src = link.href;

      if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(link.href)) {
        media.style.display = "block";
        media.style.maxWidth = "90vw";
        media.style.maxHeight = "80vh";
      } else {
        media.style.display = "none";
        window.open(link.href, "_blank");
        return;
      }

      overlay.style.display = "flex";
    };
    bubble.appendChild(link);
  } else {
    bubble.textContent = message;
  }

  // === Reaction Box ===
  const reactionBox = document.createElement("div");
  reactionBox.className = "reaction-box";
  reactionBox.reactions = reactions;
  renderReactions(reactionBox, reactions);

  const metaRow = document.createElement("div");
  metaRow.className = "meta-row";

  const timeContainer = document.createElement("div");
  timeContainer.className = "time-container";

  const metaWrapper = document.createElement("div");
  metaWrapper.className = "reaction-meta-wrapper";

  const time = document.createElement("span");
  time.className = "timestamp";
  time.textContent = formatTime12h(timestamp);

  const statusSpan = document.createElement("span");
  statusSpan.className = "status";
  if (isOutgoing) statusSpan.innerHTML = getStatusIcon(status);

  const messageActions = document.createElement("div");
  messageActions.className = "message-actions";

  const menuButton = document.createElement("button");
  menuButton.className = "menu-button";
  menuButton.innerHTML = `<i class="fa-solid fa-ellipsis-vertical"></i>`;
  menuButton.onclick = (e) => {
    e.stopPropagation();
    showMenuPopup(e, {
      id, // ✅ Pass message ID
      from,
      to: toUser,
      message,
      timestamp,
      type,
      status
    });
  };

  // === Reaction Wrapper (Smile Button) ===
  const reactionWrapper = document.createElement("div");
  requestAnimationFrame(() => {
    addReactionButton(bubble, reactionWrapper, id, isOutgoing, toUser);
  });

  // === Arrange Meta: sent vs received ===
  if (isOutgoing) {
    messageActions.appendChild(menuButton);
    messageActions.appendChild(reactionWrapper);
    messageActions.appendChild(time);
    messageActions.appendChild(statusSpan);
    metaWrapper.appendChild(messageActions);
    messageStatusMap[id] = statusSpan;
  } else {
    metaWrapper.appendChild(time);
    messageActions.appendChild(reactionWrapper);
    messageActions.appendChild(menuButton);
    metaWrapper.appendChild(messageActions);
  }

  timeContainer.appendChild(metaWrapper);
  metaRow.appendChild(timeContainer);

  contentWrapper.appendChild(bubble);
  contentWrapper.appendChild(reactionBox);
  contentWrapper.appendChild(metaRow);

  wrapper.appendChild(contentWrapper);
  container.appendChild(wrapper);

  scrollToBottom();
}

// === HELPER: CHECK DELETED ===
function isMessageDeletedForMe(msg) {
  return msg.deletedFor?.includes(myUsername) || msg.deletedFor?.[0] === "*";
}

// === STATUS ICON ===
function getStatusIcon(status) {
  switch (status) {
    case "sent": return "✓";
    case "delivered": return "✓✓";
    case "seen": return `<i class="fas fa-eye icon-status-seen"></i>`;
    default: return "";
  }
}

// === UPDATE MESSAGE STATUS ===
function updateMessageStatus(id, status) {
  const statusSpan = messageStatusMap[id];
  if (statusSpan) {
    statusSpan.innerHTML = getStatusIcon(status);
  }
}

// === UPDATE PARTNER STATUS ===
function updateStatus(text) {
  const el = document.getElementById("partnerStatus");
  el.textContent = text;
  setTimeout(() => {
    if (currentChat) socket.emit("get-last-seen", currentChat);
  }, 3000); // Poll again after 3s
}

// === HANDLE MESSAGE DELETED (by ID) ===
socket.on("messageDeleted", ({ id }) => {
  const el = document.querySelector(`.message[data-id="${id}"]`);
  if (el) el.closest(".message-wrapper")?.remove();
});

// === FRIENDS ===
async function loadFriends() {
  const res = await fetch("/api/friends", { credentials: "include" });
  const friends = await res.json();
  const pane = document.getElementById("friends");
  pane.innerHTML = friends.length ? "" : "<p class='empty'>No friends yet.</p>";

  friends.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.dataset.username = u.username;
    div.innerHTML = `
      <div class="avatar">${(u.fullname || u.username)[0].toUpperCase()}</div>
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
  const res = await fetch("/api/friends/requests", { credentials: "include" });
  const list = await res.json();
  const pane = document.getElementById("requests");
  pane.innerHTML = list.length ? "" : "<p class='empty'>No pending requests.</p>";

  list.forEach(user => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerHTML = `
      <div class="avatar">${(user.fullname || user.username)[0].toUpperCase()}</div>
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
  await fetch(`/api/friends/accept/${username}`, {
    method: "POST",
    credentials: "include"
  });
  showToast("success", `Accepted ${username}`);
  socket.emit("refresh-tabs", { type: "requests", target: myUsername });
  socket.emit("refresh-tabs", { type: "friends", target: myUsername });
};

window.reject = async (username) => {
  await fetch(`/api/friends/reject/${username}`, {
    method: "POST",
    credentials: "include"
  });
  showToast("info", `Rejected ${username}`);
  socket.emit("refresh-tabs", { type: "requests", target: myUsername });
};

// === GLOBAL SEARCH ===
let currentPage = 1;
let hasMoreUsers = true;
let loadingUsers = false;

async function loadSearch(reset = false, query = "") {
  if (reset) {
    currentPage = 1;
    hasMoreUsers = true;
    document.getElementById("search").innerHTML = "";
  }

  if (!hasMoreUsers || loadingUsers) return;
  loadingUsers = true;

  try {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&page=${currentPage}`, {
      credentials: "include"
    });
    const users = await res.json();

    if (users.length < 10) hasMoreUsers = false;
    currentPage++;

    const container = document.getElementById("search");
    users.forEach(user => {
      const div = document.createElement("div");
      div.className = "user-item";
      div.innerHTML = `
        <div class="avatar">${(user.fullname || user.username)[0].toUpperCase()}</div>
        <div class="info">
          <h4>${user.fullname || user.username}</h4>
          <p>@${user.username}</p>
        </div>
        <div class="actions">
          <button id="btn-${user.username}" onclick="toggleFriendRequest('${user.username}', this)">Add</button>
        </div>`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Search failed", err);
  }

  loadingUsers = false;
}

document.getElementById("search").addEventListener("scroll", e => {
  const el = e.target;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
    const query = document.getElementById("searchUsers").value.trim();
    loadSearch(false, query);
  }
});

let searchDebounce;
document.getElementById("searchUsers").addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const query = document.getElementById("searchUsers").value.trim();
    loadSearch(true, query);
  }, 300);
});

window.toggleFriendRequest = async (username, btn) => {
  const isCancel = btn.textContent === "Cancel";
  const url = isCancel ? `/api/friends/cancel/${username}` : `/api/friends/add/${username}`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include"
  });
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

    const tabName = tab.dataset.tab;
    const pane = document.getElementById(tabName);
    if (pane) pane.classList.add("active");

    if (tabName === "friends") loadFriends?.();
    else if (tabName === "requests") loadRequests?.();
    else if (tabName === "search") {
      const input = document.getElementById("searchUsers");
      input.value = "";
      input.focus();
      loadSearch(true, "");
    }
  };
});

document.querySelector(".back-button").onclick = () => {
  if (currentChat) {
    socket.emit("stop-typing", { to: currentChat });
    clearTimeout(typingDebounce);
  }
  document.querySelector(".chat-app").classList.remove("chat-open");
  currentChat = null;
};

document.querySelector(".logout-btn").onclick = async e => {
  e.preventDefault();
  if (confirm("Logout from Vaarta?")) {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include"
    });
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
// === AUTO SCROLL ON INPUT FOCUS (mobile keyboard fix) ===
document.getElementById("messageInput").addEventListener("focus", () => {
  setTimeout(() => {
    scrollToBottom();
  }, 300);
});
async function loadChats() {
  const res = await fetch("/api/chats", { credentials: "include" });
  const users = await res.json();
  const pane = document.getElementById("chats");
  pane.innerHTML = users.length ? "" : "<p class='empty'>No chats yet.</p>";

  users.forEach(username => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.dataset.username = username;
    div.innerHTML = `
      <div class="avatar">${username[0].toUpperCase()}</div>
      <div class="info">
        <h4>${username}</h4>
        <p>@${username}</p>
      </div>`;
    div.onclick = () => selectChat(username);
    pane.appendChild(div);
  });
}
