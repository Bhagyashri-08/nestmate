// utils/ExpressError.js
// Custom error class that extends built-in JS Error
// Lets us throw errors with a statusCode e.g. throw new ExpressError(404, "Not found")

class ExpressError extends Error {
  constructor(statusCode, message) {
    super();                        // calls Error constructor
    this.statusCode = statusCode;   // e.g. 400, 403, 404, 500
    this.message = message;
  }
}

module.exports = ExpressError;
