// models/user.js
// This model stores user accounts (Owners who list PGs, and Tenants who search)
// passport-local-mongoose automatically adds: username, hash, salt fields
// and methods like .register(), .authenticate()

const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,           // no two users can have the same email
  },
  role: {
    type: String,
    enum: ["owner", "tenant"],   // only these two values allowed
    default: "tenant",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// This one line adds: username, password hashing, authenticate(), register() etc.
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
