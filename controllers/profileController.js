const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const usersDir = path.join(__dirname, "../data/users");

exports.viewProfile = (req, res) => {
  const { username } = req.session.user || {};
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  const file = path.join(usersDir, `${username}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "User not found" });

  const user = JSON.parse(fs.readFileSync(file));
  delete user.password;
  res.json(user);
};

exports.updateProfile = (req, res) => {
  const { username } = req.session.user || {};
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  const file = path.join(usersDir, `${username}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "User not found" });

  const existing = JSON.parse(fs.readFileSync(file));
  const updated = { ...existing, ...req.body };
  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  res.json({ message: "Profile updated" });
};

exports.changePassword = async (req, res) => {
  const { username } = req.session.user || {};
  const { oldPassword, newPassword } = req.body;

  const file = path.join(usersDir, `${username}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "User not found" });

  const user = JSON.parse(fs.readFileSync(file));
  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) return res.status(401).json({ error: "Incorrect old password" });

  user.password = await bcrypt.hash(newPassword, 10);
  fs.writeFileSync(file, JSON.stringify(user, null, 2));
  res.json({ message: "Password changed" });
};
