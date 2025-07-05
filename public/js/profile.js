// Load profile data
async function loadProfile() {
  const res = await fetch("/api/profile");
  const user = await res.json();
  if (!res.ok) return alert(user.error);
  Object.entries(user).forEach(([key, val]) => {
    const el = document.getElementById(key);
    if (el) el.value = val;
  });
}
loadProfile();

// Update profile
document.getElementById("profileForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const data = Object.fromEntries(form.entries());

  const res = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  alert(result.message || result.error);
});

// Change password
document.getElementById("passwordForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const data = Object.fromEntries(form.entries());

  if (data.newPassword !== data.confirmPassword) {
    return alert("Passwords do not match");
  }

  const res = await fetch("/api/password-change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  alert(result.message || result.error);
});
