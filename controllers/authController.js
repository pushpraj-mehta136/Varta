const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { setFlash } = require("../middleware/flash");

const usersDir = path.join(__dirname, "../data/users");

function getUserFile(username) {
  return path.join(usersDir, `${username}.json`);
}

function userExists(username, email) {
  if (!fs.existsSync(usersDir)) return false;

  const files = fs.readdirSync(usersDir);
  return files.some(file => {
    try {
      const content = fs.readFileSync(path.join(usersDir, file), "utf-8");
      const user = JSON.parse(content);
      return user.username === username || user.email === email;
    } catch {
      return false;
    }
  });
}

exports.register = async (req, res) => {
  let { username, email, password, confirmPassword, ...rest } = req.body;

  username = username?.trim().toLowerCase();
  email = email?.trim().toLowerCase();

  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  if (userExists(username, email)) {
    return res.status(409).json({ error: "Username or email already exists" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = {
      username,
      email,
      password: hashed,
      createdAt: new Date().toISOString(),
      ...rest
    };

    if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true });
    fs.writeFileSync(getUserFile(username), JSON.stringify(newUser, null, 2));

    req.session.user = { username, email };
    setFlash(req, "success", "Registration successful");
    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
};

exports.login = async (req, res) => {
  const username = req.body.username?.trim().toLowerCase();
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const filePath = getUserFile(username);
  if (!fs.existsSync(filePath)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  try {
    const user = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    req.session.user = { username, email: user.email };
    setFlash(req, "success", "Login successful");
    res.json({ message: "Login successful" });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("❌ Logout error:", err);
      return res.status(500).json({ error: "Failed to log out" });
    }

    res.clearCookie("connect.sid", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax"
    });

    if (req.headers.accept?.includes("application/json")) {
      return res.json({ message: "Logged out" });
    }

    res.redirect("/login");
  });
};

exports.getSessionUser = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  res.json(req.session.user);
};
