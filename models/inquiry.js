// models/inquiry.js
// Stores every booking request a tenant sends to an owner
// Flow: pending → approved/rejected → if approved → paid → contact revealed

const mongoose = require("mongoose");

const inquirySchema = new mongoose.Schema({

  // Which PG is this inquiry for
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Listing",       // link to Listing model
    required: true,
  },

  // Who sent the inquiry (tenant)
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",          // link to User model
    required: true,
  },

  // Who owns the listing (owner) — stored for easy querying
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Tenant's details filled in the inquiry form
  tenantName: {
    type: String,
    required: true,
  },
  tenantPhone: {
    type: String,
    required: true,
  },
  moveInDate: {
    type: Date,
    required: true,
  },
  message: {
    type: String,
    default: "",
  },

  // Status of the inquiry — moves through these stages:
  // pending → approved or rejected
  // if approved → payment done → paid
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "paid"],
    default: "pending",
  },

  // Razorpay payment details — filled after payment
  payment: {
    orderId: String,        // Razorpay order ID (created on server)
    paymentId: String,      // Razorpay payment ID (returned after success)
    amount: Number,         // Amount paid in paise
    paidAt: Date,           // When payment was done
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Inquiry", inquirySchema);
