// === server.js ===
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

const { initSockets } = require("./sockets/chatSocket");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const uploadRoutes = require("./routes/upload");
const friendRoutes = require("./routes/friends");
const userRoutes = require("./routes/users");
const historyRoutes = require("./routes/history");

const { getFlash } = require("./middleware/flash");
const { requireAuth, redirectIfLoggedIn, attachSessionUser } = require("./middleware/auth");

require("./utils/initFolders")(); // 📁 Ensure necessary folders exist

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Session middleware
app.use(session({
  store: new FileStore({
    path: path.join(__dirname, "data/sessions"),
    ttl: 60 * 60 * 24 * 365, // 1 year
  }),
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set to true in production with HTTPS
  }
}));

// ✅ Attach session user to req.user (for convenience)
app.use(attachSessionUser);

// ✅ Block direct index.html access (forces use of "/")
app.use((req, res, next) => {
  if (req.path === "/index.html") {
    return res.redirect("/");
  }
  next();
});

// === Static Files ===
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "data/uploads")));

// === Utility APIs ===
app.get("/api/flash", (req, res) => res.json(getFlash(req) || {}));
app.get("/api/time", (req, res) => res.json({ timestamp: new Date().toISOString() }));

// ✅ Debug route to check session content
app.get("/api/session", (req, res) => res.json({ session: req.session }));

// === Public Pages (redirect if already logged in)
app.get("/", redirectIfLoggedIn, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/login", redirectIfLoggedIn, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.get("/register", redirectIfLoggedIn, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "register.html"))
);

app.get("/logout", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "logout.html"))
);

// === Private Pages (require login)
app.get("/chat", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "chat.html"))
);

app.get("/settings", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "settings.html"))
);

// === API Routes (some require auth inside route files)
app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", uploadRoutes);
app.use("/api", friendRoutes);
app.use("/api/users", userRoutes);
app.use("/history", historyRoutes);

// === WebSockets
initSockets(io);

// === Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Internal Server Error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// === Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Vaarta running at http://localhost:${PORT}`);
});
