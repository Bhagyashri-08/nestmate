// models/listing.js
// Stores all PG / room listings posted by owners

const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,          // must be provided
  },
  description: {
    type: String,
    default: "",
  },
  image: {
    type: String,
    // Default image if owner doesn't upload one
    default: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&auto=format&fit=crop",
    set: (v) => v === "" 
      ? "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&auto=format&fit=crop" 
      : v,
  },
  rent: {
    type: Number,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  locality: {
    type: String,
    required: true,
  },
  pgType: {
    type: String,
    enum: ["Boys", "Girls", "Co-ed"],   // only these options
    required: true,
  },
  roomType: {
    type: String,
    enum: ["Single", "Double", "Triple"],
    required: true,
  },
  amenities: {
    type: [String],         // array of strings e.g. ["WiFi", "AC", "Laundry"]
    default: [],
  },
  // Reference to which User posted this listing
  // ObjectId is MongoDB's unique ID type
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",            // tells mongoose to link to the User model
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Listing", listingSchema);
