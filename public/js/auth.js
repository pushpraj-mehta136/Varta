// Login
document.getElementById("loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = Object.fromEntries(form.entries());

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (res.ok) {
    location.href = "/chat";
  } else {
    alert(data.error || "Login failed");
  }
});

// Register
document.getElementById("registerForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = Object.fromEntries(form.entries());

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (res.ok) {
    location.href = "/chat";
  } else {
    alert(data.error || "Registration failed");
  }
});
