import { showToast } from "./toast.js";

// === Load Friends List ===
export async function loadFriends() {
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

    // Safe global chat launcher (requires chat.js defines window.selectChat)
    div.addEventListener("click", () => {
      if (window.selectChat) window.selectChat(u.username);
    });

    pane.appendChild(div);
  });
}

// === Load Friend Requests ===
export async function loadRequests() {
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
          <button class="accept-btn">Accept</button>
          <button class="cancel reject-btn">Reject</button>
        </div>
      </div>`;

    // Attach listeners dynamically (safe, scoped)
    const acceptBtn = div.querySelector(".accept-btn");
    const rejectBtn = div.querySelector(".reject-btn");

    acceptBtn.addEventListener("click", () => {
      if (window.accept) window.accept(user.username);
    });

    rejectBtn.addEventListener("click", () => {
      if (window.reject) window.reject(user.username);
    });

    pane.appendChild(div);
  });
}

// === Accept Friend Request ===
export async function acceptFriend(username, socket, myUsername) {
  const res = await fetch(`/api/friends/accept/${username}`, {
    method: "POST",
    credentials: "include"
  });
  const data = await res.json();

  if (res.ok) {
    showToast("success", `Accepted ${username}`);
    socket.emit("refresh-tabs", { type: "requests", target: myUsername });
    socket.emit("refresh-tabs", { type: "friends", target: myUsername });
  } else {
    showToast("error", data.error || "Failed to accept");
  }
}

// === Reject Friend Request ===
export async function rejectFriend(username, socket, myUsername) {
  const res = await fetch(`/api/friends/reject/${username}`, {
    method: "POST",
    credentials: "include"
  });
  const data = await res.json();

  if (res.ok) {
    showToast("info", `Rejected ${username}`);
    socket.emit("refresh-tabs", { type: "requests", target: myUsername });
  } else {
    showToast("error", data.error || "Failed to reject");
  }
}

// === Filter Friends List ===
export function filterFriends(query) {
  document.querySelectorAll("#friends .user-item").forEach(item => {
    const name = item.textContent.toLowerCase();
    item.style.display = name.includes(query) ? "" : "none";
  });
}

// === Initialization Hook ===
// Should be called after socket connection is ready
export function initFriends(socket, myUsername) {
  // Expose global functions (used in dynamic handlers)
  window.accept = (username) => acceptFriend(username, socket, myUsername);
  window.reject = (username) => rejectFriend(username, socket, myUsername);

  // Load both friends and requests
  loadFriends();
  loadRequests();
}
