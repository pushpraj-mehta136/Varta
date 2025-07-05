// toast.js

function createToast(type = "info", message = "") {
  const containerId = "toast-container";
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <span class="close-btn" onclick="this.parentElement.remove()">×</span>
  `;

  container.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Flash fetcher — call once on page load to show session flash
async function showFlashToast() {
  try {
    const res = await fetch("/api/flash");
    if (!res.ok) return;
    const { type, message } = await res.json();
    if (message) createToast(type || "info", message);
  } catch (err) {
    console.error("Flash toast fetch error:", err);
  }
}
