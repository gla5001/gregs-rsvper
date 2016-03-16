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
var EventClosedError = (function() {
  'use strict';

  /**
   * Constructor
   *
   * @param {String} msg - The error message
   */
  var EventClosedError = function (msg) {
    EventClosedError.super_.call(this, msg, this.constructor);
  };

  // inherit from BaseError
  util.inherits(EventClosedError, BaseError);

  EventClosedError.prototype.name = 'EventClosedError';

  return EventClosedError;
})();

module.exports = EventClosedError;