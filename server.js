require("dotenv").config();

const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

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
const io = socketIo(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

// === CORS for mobile/web compatibility ===
app.use(cors({
  origin: true, // allows Capacitor (file:// or http://localhost) and web
  credentials: true
}));

// === Body parsers ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Session middleware ===
app.use(session({
  store: new FileStore({
    path: path.join(__dirname, "data/sessions"),
    ttl: 60 * 60 * 24 * 365 * 10 // 10 years
  }),
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10 // 10 years
  }
}));

// === Attach session user globally ===
app.use(attachSessionUser);

// ✅ Block direct access to index.html
app.use((req, res, next) => {
  if (req.path === "/index.html") return res.redirect("/");
  next();
});

// === Static content ===
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "data/uploads")));

// === Utility APIs ===
app.get("/api/flash", (req, res) => res.json(getFlash(req) || {}));
app.get("/api/time", (req, res) => res.json({ timestamp: new Date().toISOString() }));
app.get("/api/session", (req, res) => res.json({ session: req.session }));

// === Public Pages ===
app.get("/", redirectIfLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/login", redirectIfLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/register", redirectIfLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});
app.get("/logout", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "logout.html"));
});

// === Private Pages ===
app.get("/chat", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});
app.get("/settings", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "settings.html"));
});

// === Routes ===
app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", uploadRoutes);
app.use("/api", friendRoutes);
app.use("/api/users", userRoutes);
app.use("/history", historyRoutes);

// === WebSockets ===
initSockets(io);

// === Global error handler ===
app.use((err, req, res, next) => {
  console.error("❌ Internal Server Error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// === Server Start ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Vaarta running at http://localhost:${PORT}`);
});
