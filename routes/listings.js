// routes/listings.js
// All routes related to PG listings are here
// Separated from app.js to keep code clean (MVC pattern)

const express = require("express");
const router = express.Router();   // mini express app for routing

const Listing = require("../models/listing");
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const { listingSchema } = require("../schema");
const { isLoggedIn, isOwner } = require("../middleware/auth");

// ─── Joi Validation Middleware ───────────────────────────────────────────────
const validateListing = (req, res, next) => {
  // Normalize amenities: checkboxes come as string or array
  if (req.body.listing && req.body.listing.amenities) {
    if (typeof req.body.listing.amenities === "string") {
      req.body.listing.amenities = [req.body.listing.amenities];
    }
  } else if (req.body.listing) {
    req.body.listing.amenities = [];
  }

  const { error } = listingSchema.validate(req.body);
  if (error) {
    // error.details is an array of validation errors, join them into one message
    const errMsg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, errMsg);
  }
  next();
};

// ─── INDEX — Show all listings with optional filters ─────────────────────────
// GET /listings
router.get("/", wrapAsync(async (req, res) => {
  // Destructure query params from URL e.g. /listings?city=pune&pgType=Girls
  const { city, pgType, roomType, minRent, maxRent } = req.query;

  // Build a filter object dynamically
  let filter = {};

  // case-insensitive search for city using regex
  if (city && city.trim() !== "") {
    filter.city = { $regex: city.trim(), $options: "i" };
  }
  if (pgType && pgType !== "All") {
    filter.pgType = pgType;
  }
  if (roomType && roomType !== "All") {
    filter.roomType = roomType;
  }
  // Rent range filter
  if (minRent || maxRent) {
    filter.rent = {};
    if (minRent) filter.rent.$gte = Number(minRent);  // $gte = greater than or equal
    if (maxRent) filter.rent.$lte = Number(maxRent);  // $lte = less than or equal
  }

  const allListings = await Listing.find(filter);
  res.render("listings/index", { allListings, filters: req.query });
}));

// ─── NEW — Show form to create new listing ───────────────────────────────────
// GET /listings/new  (must be before /:id or "new" would be treated as an ID)
router.get("/new", isLoggedIn, (req, res) => {
  res.render("listings/new");
});

// ─── SHOW — Show single listing detail ───────────────────────────────────────
// GET /listings/:id
router.get("/:id", wrapAsync(async (req, res) => {
  // .populate("owner") replaces the ObjectId with the actual User document
  const listing = await Listing.findById(req.params.id).populate("owner", "username email");

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  res.render("listings/show", { listing });
}));

// ─── CREATE — Save new listing to DB ─────────────────────────────────────────
// POST /listings
router.post("/", isLoggedIn, validateListing, wrapAsync(async (req, res) => {
  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;   // attach the logged-in user as owner
  await newListing.save();
  req.flash("success", "New PG listing created successfully!");
  res.redirect("/listings");
}));

// ─── EDIT — Show edit form ────────────────────────────────────────────────────
// GET /listings/:id/edit
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  res.render("listings/edit", { listing });
}));

// ─── UPDATE — Save edited listing ────────────────────────────────────────────
// PUT /listings/:id
router.put("/:id", isLoggedIn, isOwner, validateListing, wrapAsync(async (req, res) => {
  await Listing.findByIdAndUpdate(req.params.id, req.body.listing, { new: true });
  req.flash("success", "Listing updated successfully!");
  res.redirect(`/listings/${req.params.id}`);
}));

// ─── DELETE — Remove listing ──────────────────────────────────────────────────
// DELETE /listings/:id
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing deleted.");
  res.redirect("/listings");
}));

module.exports = router;
