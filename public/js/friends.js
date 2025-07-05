// Load Friends
async function loadFriends() {
  const res = await fetch("/api/friends");
  const friends = await res.json();
  const container = document.getElementById("friends");
  container.innerHTML = "";

  if (!friends.length) {
    container.innerHTML = `<p class="empty">No friends yet.</p>`;
    return;
  }

  friends.forEach(friend => {
    const item = document.createElement("div");
    item.className = "user-item";
    item.dataset.username = friend.username;
    item.innerHTML = `
      <div class="avatar">${friend.username[0].toUpperCase()}</div>
      <div class="info">
        <h4>${friend.fullname || friend.username}</h4>
        <p>@${friend.username}</p>
      </div>
    `;
    item.onclick = () => selectChat(friend.username);
    container.appendChild(item);
  });
}

// Load Requests
async function loadRequests() {
  const res = await fetch("/api/friends/requests");
  const requests = await res.json();
  const container = document.getElementById("requests");
  container.innerHTML = "";

  if (!requests.length) {
    container.innerHTML = `<p class="empty">No pending requests.</p>`;
    return;
  }

  requests.forEach(user => {
    const item = document.createElement("div");
    item.className = "user-item";
    item.innerHTML = `
      <div class="avatar">${user.username[0].toUpperCase()}</div>
      <div class="info">
        <h4>${user.fullname || user.username}</h4>
        <p>@${user.username}</p>
        <div class="actions">
          <button onclick="acceptRequest('${user.username}')">Accept</button>
          <button onclick="rejectRequest('${user.username}')">Reject</button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Accept / Reject Friend Requests
async function acceptRequest(username) {
  const res = await fetch(`/api/friends/accept/${username}`, { method: "POST" });
  const result = await res.json();
  showToast(result.message || "Accepted", "success");
  loadRequests();
  loadFriends();
}

async function rejectRequest(username) {
  const res = await fetch(`/api/friends/reject/${username}`, { method: "POST" });
  const result = await res.json();
  showToast(result.message || "Rejected", "warning");
  loadRequests();
}

// Global Search + Pagination
let searchPage = 1;
let isFetching = false;
let currentQuery = "";

async function loadSearch(query = "", reset = false) {
  if (isFetching) return;
  isFetching = true;

  if (reset) {
    document.getElementById("search").innerHTML = "";
    searchPage = 1;
    currentQuery = query;
  }

  const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&page=${searchPage}`);
  const users = await res.json();

  renderSearchResults(users);
  searchPage++;
  isFetching = false;
}

// Search input
document.getElementById("searchUsers")?.addEventListener("input", e => {
  loadSearch(e.target.value.trim(), true);
});

// Infinite scroll
document.getElementById("search").addEventListener("scroll", e => {
  const el = e.target;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
    loadSearch(currentQuery);
  }
});

// Render global users
function renderSearchResults(users) {
  const container = document.getElementById("search");

  if (!users.length && searchPage === 1) {
    container.innerHTML = `<p class="empty">No users found.</p>`;
    return;
  }

  users.forEach(user => {
    const item = document.createElement("div");
    item.className = "user-item";
    item.dataset.username = user.username;

    item.innerHTML = `
      <div class="avatar">${user.username[0].toUpperCase()}</div>
      <div class="info" onclick="showProfile('${user.username}')">
        <h4>${user.fullname || user.username}</h4>
        <p>@${user.username}</p>
      </div>
      <div class="actions">
        <button id="btn-${user.username}" onclick="toggleFriendRequest('${user.username}', this)">
          Add Friend
        </button>
      </div>
    `;

    container.appendChild(item);
  });
}

// Profile preview (simple modal or alert)
function showProfile(username) {
  alert("Preview for @" + username); // Replace with modal logic
}

// Friend request toggle
async function toggleFriendRequest(username, btn) {
  const isAdd = btn.textContent === "Add Friend";
  const endpoint = isAdd ? `/api/friends/add/${username}` : `/api/friends/cancel/${username}`;

  const res = await fetch(endpoint, { method: "POST" });
  const result = await res.json();

  if (res.ok) {
    btn.textContent = isAdd ? "Cancel" : "Add Friend";
    showToast(result.message || "Success", isAdd ? "success" : "info");
  } else {
    showToast(result.error || "Failed", "error");
  }
}

// Toast Utility
function showToast(message, type = "info") {
  const container = document.querySelector(".toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `${message}<span class="close-btn" onclick="this.parentElement.remove()">×</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function createToastContainer() {
  const div = document.createElement("div");
  div.className = "toast-container";
  document.body.appendChild(div);
  return div;
}

// Tabs
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// Initial Load
loadFriends();
loadRequests();
loadSearch("", true);
