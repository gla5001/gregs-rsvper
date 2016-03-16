/*
 * Copyright (C) 2016 Greg Alexander.
 *
 * Copied from http://dustinsenos.com/articles/customErrorsInNode
 */

var util = require('util');

module.exports = (function() {
  'use strict';

  // Create a new Abstract Error constructor
  var BaseError = function (msg, constr) {
    // If defined, pass the constr property to V8's
    // captureStackTrace to clean up the output
    Error.captureStackTrace(this, constr || this);

    // If defined, store a custom error message
    this.message = msg || 'Error';
  };

  // Extend our BaseError from Error (http://nodejs.org/api/util.html#util_util_inherits_constructor_superconstructor)
  util.inherits(BaseError, Error);

  // Give our Base error a name property. Helpful for logging the error later.
  BaseError.prototype.name = 'Base Error';

  return BaseError;
})();
