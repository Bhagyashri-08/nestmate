// utils/wrapAsync.js
// Instead of writing try/catch in every async route,
// we wrap the function and any error automatically goes to next(err)
// which is caught by our error handler at the bottom of app.js

module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);  // .catch(next) passes error to Express error handler
  };
};
