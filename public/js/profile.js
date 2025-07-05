// === Load Profile Data ===
async function loadProfile() {
  try {
    const res = await fetch("/api/profile", {
      credentials: "include" // ✅ Include session cookie
    });

    const user = await res.json();
    if (!res.ok) return showMessage(user.error || "Failed to load profile", "error");

    Object.entries(user).forEach(([key, val]) => {
      const el = document.getElementById(key);
      if (el) el.value = val;
    });
  } catch (err) {
    console.error("Profile load failed:", err);
    showMessage("Network/server error while loading profile", "error");
  }
}
loadProfile();

// === Update Profile ===
document.getElementById("profileForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const data = Object.fromEntries(form.entries());

  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // ✅ Include cookie
      body: JSON.stringify(data)
    });

    const result = await res.json();
    showMessage(result.message || result.error, res.ok ? "success" : "error");
  } catch (err) {
    console.error("Profile update failed:", err);
    showMessage("Error updating profile", "error");
  }
});

// === Change Password ===
document.getElementById("passwordForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const data = Object.fromEntries(form.entries());

  if (data.newPassword !== data.confirmPassword) {
    return showMessage("Passwords do not match", "error");
  }

  try {
    const res = await fetch("/api/password-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // ✅ Include session cookie
      body: JSON.stringify(data)
    });

    const result = await res.json();
    showMessage(result.message || result.error, res.ok ? "success" : "error");
  } catch (err) {
    console.error("Password change failed:", err);
    showMessage("Error changing password", "error");
  }
});

// === Optional Toast / Inline Error UI ===
function showMessage(msg, type = "info") {
  alert(msg);

  // Optional: inline message UI instead of alert
  // const box = document.getElementById("errorBox");
  // if (box) {
  //   box.textContent = msg;
  //   box.style.color = type === "error" ? "red" : "green";
  //   box.style.display = "block";
  //   setTimeout(() => box.style.display = "none", 5000);
  // }
}
