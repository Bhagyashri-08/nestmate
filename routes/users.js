// routes/users.js
// Handles user registration and login/logout

const express = require("express");
const router = express.Router();
const passport = require("passport");

const User = require("../models/user");
const wrapAsync = require("../utils/wrapAsync");

// ─── REGISTER ─────────────────────────────────────────────────────────────────

// Show register form
router.get("/register", (req, res) => {
  res.render("users/register");
});

// Handle registration form submission
router.post("/register", wrapAsync(async (req, res) => {
  const { username, email, password, role } = req.body;

  // Create a new User (without password — passport handles hashing)
  const newUser = new User({ username, email, role });

  // .register() is from passport-local-mongoose
  // It hashes the password and saves the user
  const registeredUser = await User.register(newUser, password);

  // Automatically log in the user after registration
  // req.login() is from Passport
  req.login(registeredUser, (err) => {
    if (err) return next(err);
    req.flash("success", `Welcome to NestMate, ${username}!`);
    res.redirect("/listings");
  });
}));

// ─── LOGIN ────────────────────────────────────────────────────────────────────

// Show login form
router.get("/login", (req, res) => {
  res.render("users/login");
});

// Handle login — passport.authenticate() is middleware that checks username/password
// "local" = use our LocalStrategy (username + password from DB)
// failureFlash: true — shows error message on wrong credentials
// failureRedirect — where to go if login fails
router.post("/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    req.flash("success", `Welcome back, ${req.user.username}!`);
    // Redirect to the page they were trying to visit, or /listings
    const redirectUrl = res.locals.returnTo || "/listings";
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

router.post("/logout", (req, res, next) => {
  // req.logout() is from Passport — clears the login session
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Logged out successfully!");
    res.redirect("/listings");
  });
});

module.exports = router;
