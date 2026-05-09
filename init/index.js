// init/index.js
// Run this ONCE to populate the database with sample data
// Command: node init/index.js

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const initData = require("./data");
const Listing = require("../models/listing");
const User = require("../models/user");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/nestmate";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to DB");

  // Create a demo owner user for the sample listings
  await User.deleteMany({});
  const demoOwner = new User({ username: "demo_owner", email: "demo@nestmate.com", role: "owner" });
  await User.register(demoOwner, "demo1234");  // hashes password and saves
  console.log("Demo user created — username: demo_owner, password: demo1234");

  // Delete existing listings and insert fresh sample data
  await Listing.deleteMany({});
  const listings = initData.data.map((l) => ({ ...l, owner: demoOwner._id }));
  await Listing.insertMany(listings);
  console.log(`✅ ${listings.length} listings seeded`);

  mongoose.connection.close();
}

main().catch((err) => {
  console.log(err);
  mongoose.connection.close();
});
