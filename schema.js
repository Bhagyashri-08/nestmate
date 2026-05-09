// schema.js
// Joi is used for SERVER-SIDE validation
// Even if someone bypasses the browser form, server will still validate

const Joi = require("joi");

// Listing validation rules
module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title:       Joi.string().required(),
    description: Joi.string().required(),
    rent:        Joi.number().min(0).required(),
    city:        Joi.string().required(),
    locality:    Joi.string().required(),
    pgType:      Joi.string().valid("Boys", "Girls", "Co-ed").required(),
    roomType:    Joi.string().valid("Single", "Double", "Triple").required(),
    image:       Joi.string().allow("", null),
    amenities:   Joi.array().items(Joi.string()).default([]),
  }).required(),
});

// User registration validation
module.exports.userSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(20).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role:     Joi.string().valid("owner", "tenant").required(),
});
