// middleware/auth.js

/**
 * Middleware to protect routes that require authentication.
 * If not logged in, redirects to /login (for pages) or returns 401 (for APIs).
 */
function requireAuth(req, res, next) {
  if (req.session?.user?.username) {
    return next();
  }

  // Detect API vs Page request (basic check)
  const isApiRequest = req.originalUrl.startsWith("/api") || req.headers.accept?.includes("application/json");

  if (isApiRequest) {
    return res.status(401).json({ error: "Unauthorized" });
  } else {
    return res.redirect("/login");
  }
}

/**
 * Middleware to redirect logged-in users away from public routes (e.g. /login, /register)
 */
function redirectIfLoggedIn(req, res, next) {
  if (req.session?.user?.username) {
    return res.redirect("/chat");
  }
  next();
}

/**
 * Middleware to attach session user to req.user for convenience.
 * Optional – helps standardize usage.
 */
function attachSessionUser(req, res, next) {
  if (req.session?.user?.username) {
    req.user = req.session.user;
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfLoggedIn,
  attachSessionUser
};
