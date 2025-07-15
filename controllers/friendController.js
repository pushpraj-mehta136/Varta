const fs = require("fs");
const path = require("path");

const FRIENDS_DIR = path.join(__dirname, "../data/friends");
const USERS_DIR = path.join(__dirname, "../data/users");

if (!fs.existsSync(FRIENDS_DIR)) fs.mkdirSync(FRIENDS_DIR, { recursive: true });

// ------------------------ Helpers ------------------------

function getFriendFile(username) {
  return path.join(FRIENDS_DIR, `${username}.json`);
}

function getUser(username) {
  const file = path.join(USERS_DIR, `${username}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file));
}

function initFriendFile(username) {
  const file = getFriendFile(username);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ friends: [], requests: [] }, null, 2));
  }
}

function getAllUsers() {
  return fs.readdirSync(USERS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(USERS_DIR, f))));
}

// ------------------------ APIs ------------------------

// ✅ Get friend list
exports.getFriends = (req, res) => {
  const user = req.session.user?.username;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  initFriendFile(user);
  const { friends } = JSON.parse(fs.readFileSync(getFriendFile(user)));
  const list = friends.map(getUser).filter(Boolean);
  res.json(list);
};

// ✅ Get friend requests
exports.getRequests = (req, res) => {
  const user = req.session.user?.username;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  initFriendFile(user);
  const { requests } = JSON.parse(fs.readFileSync(getFriendFile(user)));
  const list = requests.map(getUser).filter(Boolean);
  res.json(list);
};

// ✅ Send a friend request
exports.sendRequest = (req, res) => {
  const from = req.session.user?.username;
  const to = req.params.to;
  if (!from || !to || from === to) return res.status(400).json({ error: "Invalid request" });

  const toUser = getUser(to);
  if (!toUser) return res.status(404).json({ error: "User not found" });

  initFriendFile(to);
  const toData = JSON.parse(fs.readFileSync(getFriendFile(to)));

  if (toData.friends.includes(from)) {
    return res.status(400).json({ error: "Already friends" });
  }

  if (!toData.requests.includes(from)) {
    toData.requests.push(from);
    fs.writeFileSync(getFriendFile(to), JSON.stringify(toData, null, 2));
  }

  res.json({ message: "Friend request sent" });
};

// ✅ Cancel friend request
exports.cancelRequest = (req, res) => {
  const from = req.session.user?.username;
  const to = req.params.to;
  if (!from || !to) return res.status(400).json({ error: "Invalid request" });

  initFriendFile(to);
  const toData = JSON.parse(fs.readFileSync(getFriendFile(to)));
  toData.requests = toData.requests.filter(u => u !== from);
  fs.writeFileSync(getFriendFile(to), JSON.stringify(toData, null, 2));

  res.json({ message: "Request cancelled" });
};

// ✅ Accept friend request
exports.acceptRequest = (req, res) => {
  const me = req.session.user?.username;
  const from = req.params.from;
  if (!me || !from) return res.status(400).json({ error: "Invalid request" });

  initFriendFile(me);
  initFriendFile(from);

  const myData = JSON.parse(fs.readFileSync(getFriendFile(me)));
  const theirData = JSON.parse(fs.readFileSync(getFriendFile(from)));

  if (!myData.friends.includes(from)) myData.friends.push(from);
  myData.requests = myData.requests.filter(u => u !== from);

  if (!theirData.friends.includes(me)) theirData.friends.push(me);

  fs.writeFileSync(getFriendFile(me), JSON.stringify(myData, null, 2));
  fs.writeFileSync(getFriendFile(from), JSON.stringify(theirData, null, 2));

  res.json({ message: "Friend request accepted" });
};

// ✅ Reject friend request
exports.rejectRequest = (req, res) => {
  const me = req.session.user?.username;
  const from = req.params.from;
  if (!me || !from) return res.status(400).json({ error: "Invalid request" });

  initFriendFile(me);
  const myData = JSON.parse(fs.readFileSync(getFriendFile(me)));
  myData.requests = myData.requests.filter(u => u !== from);
  fs.writeFileSync(getFriendFile(me), JSON.stringify(myData, null, 2));

  res.json({ message: "Friend request rejected" });
};

// ✅ Global user search (random, query, pagination)
exports.searchUsers = (req, res) => {
  const me = req.session.user?.username;
  const query = req.query.q?.toLowerCase();
  const page = parseInt(req.query.page || "1");
  const limit = 10;

  if (!me) return res.status(401).json({ error: "Unauthorized" });

  initFriendFile(me);
  const { friends, requests } = JSON.parse(fs.readFileSync(getFriendFile(me)));

  let users = getAllUsers().filter(u =>
    u.username !== me &&
    !friends.includes(u.username) &&
    !requests.includes(u.username)
  );

  if (query === "random") {
    users = users.sort(() => 0.5 - Math.random()).slice(0, 5);
  } else if (query) {
    users = users.filter(u =>
      u.username.toLowerCase().includes(query) ||
      u.fullname?.toLowerCase().includes(query)
    );
  }

  const start = (page - 1) * limit;
  const paginated = users.slice(start, start + limit);

  // ✅ Sanitize each user object before sending
  const safeUsers = paginated.map(user => ({
    username: user.username,
    fullname: user.fullname || ""
  }));

  res.json(safeUsers);
};
