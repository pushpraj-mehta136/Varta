const socket = io();

let currentUser = null;
let currentChat = null;

// === On socket connect: get current user and join room
socket.on("connect", async () => {
  const res = await fetch("/api/session-user");
  if (!res.ok) return location.href = "/login";
  const data = await res.json();
  currentUser = data.username;
  socket.emit("join", currentUser);
});

// === Active Users: show online indicators
socket.on("active-users", (users) => {
  document.querySelectorAll(".user-item").forEach((el) => {
    const username = el.dataset.username;
    el.classList.toggle("online", users.includes(username));
  });
});

// === Incoming message
socket.on("receive-message", (msg) => {
  if (msg.from === currentChat || msg.to === currentChat) {
    appendMessage(msg);
    scrollToBottom();
    socket.emit("seen-messages", { from: msg.from, to: currentUser });
  }
});

// === Typing indicator
socket.on("show-typing", ({ from }) => {
  if (from === currentChat) showTyping();
});

// === Seen status update
socket.on("mark-seen", ({ sender, timestamp }) => {
  if (sender === currentChat) {
    const status = document.getElementById("partnerStatus");
    status.textContent = `Seen at ${formatTime12h(timestamp)}`;
  }
});

// === Last seen info
socket.on("last-seen", ({ username, lastSeen }) => {
  if (username === currentChat) {
    const status = document.getElementById("partnerStatus");
    status.textContent = lastSeen === "Online" ? "Online" : `Last seen at ${formatTime12h(lastSeen)}`;
  }
});

// === Set active chat
function setActiveChat(partner) {
  currentChat = partner;
  document.getElementById("partnerName").textContent = partner;
  document.getElementById("messages").innerHTML = "";
  document.getElementById("partnerStatus").textContent = "Loading...";
  fetchChatHistory(partner);
  socket.emit("get-last-seen", partner);
}

// === Send message
function sendMessage(content, type = "text", originalName = "") {
  if (!currentChat || !content) return;

  const timestamp = new Date().toISOString();
  const msg = {
    to: currentChat,
    message: content,
    timestamp,
    type,
    originalName
  };

  appendMessage({ ...msg, from: currentUser });
  scrollToBottom();
  socket.emit("private-message", msg);
}

// === Typing
function sendTyping() {
  if (currentChat) {
    socket.emit("typing", { to: currentChat });
  }
}

// === Load chat history
async function fetchChatHistory(partner) {
  try {
    const res = await fetch(`/history/${partner}`);
    const history = await res.json();
    history.forEach(msg => appendMessage(msg));
    scrollToBottom();
    socket.emit("seen-messages", { from: partner, to: currentUser });
  } catch {
    showStatus("Failed to load chat history");
  }
}

// === Append message to chat box
function appendMessage({ from, message, timestamp, type, originalName }) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "message " + (from === currentUser ? "outgoing" : "incoming");

  if (type === "file") {
    const link = document.createElement("a");
    link.href = message;
    link.textContent = originalName || "Download";
    link.target = "_blank";
    div.appendChild(link);
  } else {
    div.textContent = message;
  }

  const time = document.createElement("span");
  time.className = "time";
  time.textContent = formatTime12h(timestamp);
  div.appendChild(time);

  container.appendChild(div);
}

// === Typing indicator UI
function showTyping() {
  const status = document.getElementById("partnerStatus");
  status.textContent = "Typing...";
  setTimeout(() => {
    if (currentChat) socket.emit("get-last-seen", currentChat);
  }, 3000);
}

// === Scroll to bottom
function scrollToBottom() {
  const messages = document.getElementById("messages");
  messages.scrollTop = messages.scrollHeight;
}

// === Format ISO to 12h time
function formatTime12h(iso) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

// === Show status message
function showStatus(text) {
  const status = document.getElementById("partnerStatus");
  status.textContent = text;
}

// === Exported for global access
window.vaartaSocket = {
  setActiveChat,
  sendMessage,
  sendTyping
};
