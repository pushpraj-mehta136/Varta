const express = require("express");
const { viewProfile, updateProfile, changePassword } = require("../controllers/profileController");
const { body } = require("express-validator");

const router = express.Router();

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized. Please login." });
}

// Protected Routes
router.get("/profile", isAuthenticated, viewProfile);
router.post("/profile", isAuthenticated, updateProfile);
router.post(
  "/password-change",
  isAuthenticated,
  body("newPassword").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  changePassword
);

module.exports = router;
