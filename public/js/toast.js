// === Create Toast ===
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

// === Show Flash Toast from Server Session ===
async function showFlashToast() {
  try {
    const res = await fetch("/api/flash", {
      credentials: "include" // ✅ Include session cookie (critical on production)
    });

    if (!res.ok) return;

    const flash = await res.json();

    // Handle multiple flash messages (if supported)
    if (Array.isArray(flash)) {
      flash.forEach(f => {
        if (f?.message) createToast(f.type || "info", f.message);
      });
    } else if (flash?.message) {
      createToast(flash.type || "info", flash.message);
    }
  } catch (err) {
    console.error("⚠️ Flash toast fetch error:", err);
  }
}
