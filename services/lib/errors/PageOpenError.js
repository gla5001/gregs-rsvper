/*
 * Copyright (C) 2016 Greg Alexander.
 */

// Node.js modules
var util = require('util'),
// scraper modules
  BaseError = require('./BaseError');

/**
 * @constructor
 */
var PageOpenError = (function() {
  'use strict';

  /**
   * Constructor
   *
   * @param {String} msg - The error message
   */
  var PageOpenError = function (msg) {
    PageOpenError.super_.call(this, msg, this.constructor);
  };

  // inherit from BaseError
  util.inherits(PageOpenError, BaseError);

  PageOpenError.prototype.name = 'PageOpenError';

  return PageOpenError;
})();

module.exports = PageOpenError;