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

// === Environment Flag ===
const isProd = process.env.NODE_ENV === "production";

// === Trust proxy for secure cookies in prod (Render) ===
if (isProd) {
  app.set("trust proxy", 1);
}

// === CORS ===
app.use(cors({
  origin: (origin, callback) => callback(null, true), // Allow all origins (or restrict as needed)
  credentials: true
}));

// === Body Parsers ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Session Setup ===
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
    secure: isProd,                          // 🔐 Only HTTPS in prod
    sameSite: isProd ? "None" : "Lax",       // 🌍 Cross-site only in prod
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10   // 🕒 10 years
    // domain: process.env.COOKIE_DOMAIN || undefined
  }
}));

// === Attach session user to all requests ===
app.use(attachSessionUser);

// === Block direct access to /index.html ===
app.use((req, res, next) => {
  if (req.path === "/index.html") return res.redirect("/");
  next();
});

// === Static Assets ===
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "data/uploads")));

// === Utility Endpoints ===
app.get("/api/flash", (req, res) => res.json(getFlash(req) || {}));
app.get("/api/time", (req, res) => res.json({ timestamp: new Date().toISOString() }));
app.get("/api/session", (req, res) => res.json({ session: req.session }));
app.get("/api/whoami", (req, res) => res.json({ user: req.session.user || null }));

// === Public Pages ===
app.get("/", redirectIfLoggedIn, (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/login", redirectIfLoggedIn, (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/register", redirectIfLoggedIn, (req, res) => res.sendFile(path.join(__dirname, "public", "register.html")));
app.get("/logout", (req, res) => res.sendFile(path.join(__dirname, "public", "logout.html")));

// === Private Pages ===
app.get("/chat", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "chat.html")));
app.get("/settings", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "settings.html")));

// === API Routes ===
app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", uploadRoutes);
app.use("/api", friendRoutes);
app.use("/api/users", userRoutes);
app.use("/history", historyRoutes);

// === WebSocket Setup ===
const io = socketIo(server, {
  cors: {
    origin: true,
    credentials: true
  }
});
initSockets(io);

// === Error Handling ===
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Varta running at http://localhost:${PORT} (${isProd ? "PROD" : "DEV"})`);
});
