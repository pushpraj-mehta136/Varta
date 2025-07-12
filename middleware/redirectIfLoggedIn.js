// middleware/redirectIfLoggedIn.js
module.exports = function redirectIfLoggedIn(req, res, next) {
  if (req.session?.user) {
    return res.redirect("/chat");
  }
  next();
};
