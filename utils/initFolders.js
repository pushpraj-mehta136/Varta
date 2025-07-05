// === utils/initFolders.js ===
const fs = require("fs");
const path = require("path");

const folders = ["data/users", "data/history", "data/uploads", "data/friends"];

module.exports = () => {
  folders.forEach(folder => {
    const fullPath = path.join(__dirname, "../", folder);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  });
};


