// routes/inquiries.js
// Handles: sending inquiry, owner approve/reject, Razorpay payment

const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");   // built-in Node.js module for HMAC verification

const Inquiry = require("../models/inquiry");
const Listing = require("../models/listing");
const { isLoggedIn } = require("../middleware/auth");
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");

// ─── Razorpay instance ────────────────────────────────────────────────────────
// Razorpay needs your Key ID and Secret from the dashboard
// We read them from .env so they are never hardcoded in code
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Booking token amount — ₹500 (stored in paise: 1 rupee = 100 paise)
const BOOKING_AMOUNT = Number(process.env.BOOKING_AMOUNT) || 50000;

// ─── SEND INQUIRY ─────────────────────────────────────────────────────────────
// POST /inquiries/:listingId
// Tenant submits the "I'm Interested" form
router.post("/:listingId", isLoggedIn, wrapAsync(async (req, res) => {
  const listing = await Listing.findById(req.params.listingId);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Prevent owner from sending inquiry to their own listing
  if (listing.owner.equals(req.user._id)) {
    req.flash("error", "You cannot send an inquiry to your own listing!");
    return res.redirect(`/listings/${listing._id}`);
  }

  // Prevent duplicate inquiry — tenant shouldn't send twice for same listing
  const existing = await Inquiry.findOne({
    listing: listing._id,
    tenant:  req.user._id,
    status:  { $in: ["pending", "approved", "paid"] },
    // $in means: status is any of these values
  });

  if (existing) {
    req.flash("error", "You have already sent an inquiry for this PG!");
    return res.redirect(`/listings/${listing._id}`);
  }

  // Create and save the inquiry
  const inquiry = new Inquiry({
    listing:     listing._id,
    tenant:      req.user._id,
    owner:       listing.owner,
    tenantName:  req.body.tenantName,
    tenantPhone: req.body.tenantPhone,
    moveInDate:  req.body.moveInDate,
    message:     req.body.message || "",
  });

  await inquiry.save();
  req.flash("success", "Inquiry sent! Owner will review and approve it.");
  res.redirect("/bookings/my-requests");
}));

// ─── TENANT: MY REQUESTS ──────────────────────────────────────────────────────
// GET /bookings/my-requests
// Tenant sees all their inquiries + status
router.get("/my-requests", isLoggedIn, wrapAsync(async (req, res) => {
  // Find all inquiries where this user is the tenant
  // .populate fills in the listing details (title, city, image etc.)
  const inquiries = await Inquiry.find({ tenant: req.user._id })
    .populate("listing", "title city locality rent image")
    .populate("owner", "username email")
    .sort({ createdAt: -1 });   // newest first

  res.render("bookings/my-requests", { inquiries });
}));

// ─── OWNER: DASHBOARD ─────────────────────────────────────────────────────────
// GET /dashboard
// Owner sees all inquiries received for their listings
router.get("/owner-dashboard", isLoggedIn, wrapAsync(async (req, res) => {
  if (req.user.role !== "owner") {
    req.flash("error", "Only owners can access the dashboard!");
    return res.redirect("/listings");
  }

  // Get all inquiries where this user is the owner
  const inquiries = await Inquiry.find({ owner: req.user._id })
    .populate("listing", "title city locality rent")
    .populate("tenant", "username email")
    .sort({ createdAt: -1 });

  // Group by status for easy display
  const pending  = inquiries.filter(i => i.status === "pending");
  const approved = inquiries.filter(i => i.status === "approved");
  const paid     = inquiries.filter(i => i.status === "paid");
  const rejected = inquiries.filter(i => i.status === "rejected");

  res.render("dashboard/owner", { inquiries, pending, approved, paid, rejected });
}));

// ─── OWNER: APPROVE INQUIRY ───────────────────────────────────────────────────
// POST /inquiries/approve/:inquiryId
router.post("/approve/:inquiryId", isLoggedIn, wrapAsync(async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.inquiryId);

  if (!inquiry) throw new ExpressError(404, "Inquiry not found");

  // Security: only the owner of this inquiry can approve it
  if (!inquiry.owner.equals(req.user._id)) {
    req.flash("error", "Not authorized!");
    return res.redirect("/inquiries/owner-dashboard");
  }

  inquiry.status = "approved";
  await inquiry.save();

  req.flash("success", "Inquiry approved! Tenant can now proceed to pay.");
  res.redirect("/inquiries/owner-dashboard");
}));

// ─── OWNER: REJECT INQUIRY ────────────────────────────────────────────────────
// POST /inquiries/reject/:inquiryId
router.post("/reject/:inquiryId", isLoggedIn, wrapAsync(async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.inquiryId);

  if (!inquiry) throw new ExpressError(404, "Inquiry not found");

  if (!inquiry.owner.equals(req.user._id)) {
    req.flash("error", "Not authorized!");
    return res.redirect("/inquiries/owner-dashboard");
  }

  inquiry.status = "rejected";
  await inquiry.save();

  req.flash("success", "Inquiry rejected.");
  res.redirect("/inquiries/owner-dashboard");
}));

// ─── RAZORPAY: CREATE ORDER ───────────────────────────────────────────────────
// POST /inquiries/payment/create-order/:inquiryId
// Step 1 of payment: Server creates an order on Razorpay → gets back an order ID
// This order ID is sent to frontend to open the payment popup
router.post("/payment/create-order/:inquiryId", isLoggedIn, wrapAsync(async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.inquiryId).populate("listing", "title");

  if (!inquiry) throw new ExpressError(404, "Inquiry not found");

  // Only the tenant of this inquiry can pay
  if (!inquiry.tenant.equals(req.user._id)) {
    return res.status(403).json({ error: "Not authorized" });
  }

  // Only approved inquiries can be paid
  if (inquiry.status !== "approved") {
    return res.status(400).json({ error: "Inquiry not approved yet" });
  }

  // Create order on Razorpay servers
  // amount is in paise (₹500 = 50000 paise)
  const order = await razorpay.orders.create({
    amount:   BOOKING_AMOUNT,
    currency: "INR",
    receipt:  `inquiry_${inquiry._id}`,   // your internal reference
    notes: {
      inquiryId: inquiry._id.toString(),
      listing:   inquiry.listing.title,
    },
  });

  // Save order ID to inquiry for verification later
  inquiry.payment = { orderId: order.id, amount: BOOKING_AMOUNT };
  await inquiry.save();

  // Send order details to frontend
  res.json({
    orderId:  order.id,
    amount:   BOOKING_AMOUNT,
    currency: "INR",
    keyId:    process.env.RAZORPAY_KEY_ID,
    // Pre-fill user info in Razorpay popup
    prefill: {
      name:  req.user.username,
      email: req.user.email,
    },
    inquiryId: inquiry._id,
  });
}));

// ─── RAZORPAY: VERIFY PAYMENT ─────────────────────────────────────────────────
// POST /inquiries/payment/verify
// Step 2: After payment, Razorpay sends back signature. We verify it's genuine.
// This prevents fake payment success responses.
router.post("/payment/verify", isLoggedIn, wrapAsync(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, inquiryId } = req.body;

  // HMAC-SHA256 signature verification
  // We recreate the signature using our secret key and compare
  // If signatures match → payment is genuine
  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    // Signatures don't match → payment is fake/tampered
    req.flash("error", "Payment verification failed. Please contact support.");
    return res.redirect("/bookings/my-requests");
  }

  // Signatures match → update inquiry to "paid"
  const inquiry = await Inquiry.findById(inquiryId);
  inquiry.status = "paid";
  inquiry.payment.paymentId = razorpay_payment_id;
  inquiry.payment.paidAt    = new Date();
  await inquiry.save();

  req.flash("success", "Payment successful! Booking confirmed. Owner contact details are now visible.");
  res.redirect("/bookings/my-requests");
}));

module.exports = router;
