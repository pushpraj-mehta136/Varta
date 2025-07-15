// === LOGIN FORM HANDLER ===
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = new FormData(e.target);
  const body = Object.fromEntries(form.entries());

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // ✅ Include cookies (for Render/secure sessions)
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      console.log("✅ Login success:", data);
      location.href = "/chat"; // ✅ Redirect to chat
    } else {
      console.warn("⚠️ Login failed:", data);
      showError(data.error || "Login failed.");
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    showError("Login failed due to a network or server issue.");
  }
});

// === REGISTER FORM HANDLER ===
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = new FormData(e.target);
  const body = Object.fromEntries(form.entries());

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // ✅ Include cookies
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      console.log("✅ Registration success:", data);
      location.href = "/chat";
    } else {
      console.warn("⚠️ Registration failed:", data);
      showError(data.error || "Registration failed.");
    }
  } catch (err) {
    console.error("❌ Registration error:", err);
    showError("Registration failed due to a network or server issue.");
  }
});

// === ERROR DISPLAY (ALERT OR INLINE UI) ===
function showError(msg) {
  alert(msg); // ✅ Fallback

  // === OPTIONAL: Inline error display ===
  // const errBox = document.getElementById("errorBox");
  // if (errBox) {
  //   errBox.textContent = msg;
  //   errBox.style.display = "block";
  // }
}
