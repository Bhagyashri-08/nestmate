require("dotenv").config();

const express  = require("express");
const app      = express();
const mongoose = require("mongoose");
const path     = require("path");
const methodOverride    = require("method-override");
const ejsMate           = require("ejs-mate");
const session           = require("express-session");
const flash             = require("connect-flash");
const passport          = require("passport");
const LocalStrategy     = require("passport-local");
const MongoStore        = require("connect-mongo");

const User             = require("./models/user");
const ExpressError     = require("./utils/ExpressError");
const listingRoutes    = require("./routes/listings");
const userRoutes       = require("./routes/users");
const inquiryRoutes    = require("./routes/inquiries");

// ─── Database ─────────────────────────────────────────
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/nestmate";
mongoose.connect(MONGO_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.log("DB Error:", err));

// ─── App Config ───────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// ─── Session ──────────────────────────────────────────
app.use(session({
  store: MongoStore.create({ mongoUrl: MONGO_URL, touchAfter: 24 * 3600 }),
  secret:            process.env.SESSION_SECRET || "nestmate_dev_secret",
  resave:            false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 },
}));
app.use(flash());

// ─── Passport ─────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ─── Global Locals ────────────────────────────────────
app.use((req, res, next) => {
  res.locals.success     = req.flash("success");
  res.locals.error       = req.flash("error");
  res.locals.currentUser = req.user;
  next();
});

// ─── Routes ───────────────────────────────────────────
app.get("/", (req, res) => res.redirect("/listings"));
app.use("/listings",          listingRoutes);
app.use("/",                  userRoutes);
app.use("/inquiries",         inquiryRoutes);

// Friendly URL aliases
app.get("/bookings/my-requests", (req, res) => res.redirect("/inquiries/my-requests"));
app.get("/dashboard",            (req, res) => res.redirect("/inquiries/owner-dashboard"));

// ─── 404 & Error Handler ──────────────────────────────
app.all(/.*/, (req, res, next) => next(new ExpressError(404, "Page Not Found!")));

app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error", { message, statusCode });
});

// ─── Start ────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`NestMate v2 running on http://localhost:${PORT}`));
