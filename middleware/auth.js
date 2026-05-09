// middleware/auth.js
// Middleware functions that run BEFORE route handlers
// They check conditions and either call next() to continue or redirect

const ExpressError = require("../utils/ExpressError");

// Check if user is logged in
// req.isAuthenticated() is provided by Passport.js
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash("error", "You must be logged in to do that!");
    return res.redirect("/login");
  }
  next(); // user is logged in, continue to the route
};

// Check if the logged-in user owns this listing (for edit/delete)
const Listing = require("../models/listing");
module.exports.isOwner = async (req, res, next) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // listing.owner is an ObjectId, req.user._id is also ObjectId
  // .equals() is used because you can't compare ObjectIds with ===
  if (!listing.owner.equals(req.user._id)) {
    req.flash("error", "You don't have permission to do that!");
    return res.redirect(`/listings/${id}`);
  }

  next(); // user owns the listing, continue
};
