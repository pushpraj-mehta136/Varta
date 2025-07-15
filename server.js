// === Load Environment Variables ===
require("dotenv").config();

// === Imports ===
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

// === Swagger Setup ===
const swaggerUi = require("swagger-ui-express");
const swaggerJSDoc = require("swagger-jsdoc");

// === App-Specific Modules ===
const { initSockets } = require("./sockets/chatSocket");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const uploadRoutes = require("./routes/upload");
const userRoutes = require("./routes/users");
const { getFlash } = require("./middleware/flash");
const { requireAuth, redirectIfLoggedIn, attachSessionUser } = require("./middleware/auth");
const chatsRoute = require('./routes/chats');

// === Ensure Necessary Folders Exist ===
require("./utils/initFolders")();

// === Express & Server Init ===
const app = express();
const server = http.createServer(app);

// === Environment Flag ===
const isProd = process.env.NODE_ENV === "production";
if (isProd) app.set("trust proxy", 1);

// === WebSocket Setup ===
const io = socketIo(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

// Map to track username => socket.id
const userSockets = new Map();

// Helper to get socket ID for username
function socketIdOf(username) {
  return userSockets.get(username);
}

io.on("connection", (socket) => {
  // Client should send their username after connecting
  socket.on("join", (username) => {
    if (username) {
      userSockets.set(username, socket.id);
      // Optionally, broadcast online status, etc.
    }
  });

  socket.on("disconnect", () => {
    // Remove disconnected socket from map
    for (const [username, id] of userSockets.entries()) {
      if (id === socket.id) {
        userSockets.delete(username);
        break;
      }
    }
  });
});

// Attach other socket.io handlers
initSockets(io); 

// === Swagger Configuration ===
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Varta Chat API',
    version: '1.0.0',
    description: 'API documentation for the Varta real-time chat app',
  },
  servers: [
    {
      url: 'http://localhost:3000', // Update this for production
    },
  ],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./routes/*.js'], // All route files to scan for Swagger comments
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// === Middleware ===
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10
  }
}));

app.use(attachSessionUser);

// === Prevent Direct Access to /index.html ===
app.use((req, res, next) => {
  if (req.path === "/index.html") return res.redirect("/");
  next();
});

// === Static Files ===
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "data/uploads")));

// === Utility Endpoints ===
app.get("/api/flash", (req, res) => res.json(getFlash(req) || {}));
app.get("/api/time", (req, res) => res.json({ timestamp: new Date().toISOString() }));
app.get("/api/session", (req, res) => res.json({ session: req.session }));
app.get("/api/whoami", (req, res) => res.json({ user: req.session.user || null }));

// === Public Pages ===
app.get("/", redirectIfLoggedIn, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);
app.get("/login", redirectIfLoggedIn, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);
app.get("/register", redirectIfLoggedIn, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "register.html"))
);

// === Protected Pages ===
app.get("/chat", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "chat.html"))
);
app.get("/settings", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "settings.html"))
);

// === API Routes ===
app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", uploadRoutes);

// Pass io and socketIdOf to friendRoutes so it can emit realtime socket events
const friendRoutes = require("./routes/friends")(io, socketIdOf);
app.use("/api", friendRoutes);

app.use("/api/users", userRoutes);
app.use('/api/chats', chatsRoute);

// === Chat History Routes (Require io) ===
const historyRoutes = require("./routes/history")(io);
app.use("/history", historyRoutes);

// === Global Error Handler ===
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

function listAllRoutes(app) {
  console.log("\n📦 All Registered API Routes:");
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const method = Object.keys(middleware.route.methods)[0].toUpperCase();
      console.log(`${method} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const method = Object.keys(handler.route.methods)[0].toUpperCase();
          console.log(`${method} ${handler.route.path}`);
        }
      });
    }
  });
}

listAllRoutes(app);

// === Start Server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Varta running at http://localhost:${PORT} (${isProd ? "PROD" : "DEV"})`);
  console.log(`📘 Swagger docs available at http://localhost:${PORT}/api-docs`);
});
