/*
 * Copyright (C) 2016 Greg Alexander.
 */

/**
 * Service used for performing rsvp operations.
 */
var RsvpService = (function() {
  'use strict';

  // 3rd party modules
  var Promise = require('bluebird'),
    phantom = require('phantom'),
    // Node Modules
    path = require('path'),
    // scraper modules
    EventClosedError = require('./errors').EventClosedError,
    PageOpenError = require('./errors').PageOpenError;

  //constants
  var REDIRECT_NOTICE = 'Redirect Notice',
    REGISTERED = 'registered',
    NOT_REGISTERED = 'not registered';

  var waitForPageLoad = function(millisToWait, resolvedVal) {
    millisToWait = millisToWait || 0;

    return new Promise(function(resolve, reject) {
      // allow page to open
      setTimeout(function() {
        resolve(resolvedVal);
      }, millisToWait);
    });
  };

  var eventbriteRsvp = function(params) {
    // used for screen capture name
    var eventName = params.event || 'event',
      url = params.url,
      firstName = params.firstName,
      lastName = params.lastName,
      email = params.email;

    if (!url) {
      return Promise.reject(new Error('must have a rsvp link.'));
    }

    if (!firstName) {
      return Promise.reject(new Error('must have a firstName.'));
    }

    if (!lastName) {
      return Promise.reject(new Error('must have a lastName.'));
    }

    if (!email) {
      return Promise.reject(new Error('must have a email.'));
    }

    // create a headless phantomJS browser.
    return phantom.create()
      .then(function(ph) {
        return ph.createPage()
          .then(function(page) {
            // open a webpage
            return page.open(url)
              .then(function(status) {
                return RsvpService.waitForPageLoad(3500, status);
              })
              .then(function(status) {
                if (status !== 'success') {
                  return Promise.reject(new PageOpenError('something happened trying to open page'));
                }

                // this is a bit funky but its returning a promise
                // get title of page to see if we need to redirect
                return page.evaluate(function() {
                  return document.title;
                });
              })
              .then(function(title) {
                var pageOpenPromise = Promise.resolve('success');
                // If the title is REDIRECT_NOTICE we need to follow the link.
                if (title === REDIRECT_NOTICE) {
                  console.log('need to redirect');
                  //go to redirect link
                  pageOpenPromise = page.evaluate(function() {
                      return document.getElementsByTagName('a').length > 0;
                    })
                    .then(function(hasNewLocal) {
                      if (!hasNewLocal) {
                        return Promise.reject(new EventClosedError('Doesnt have a new link to redirect to'));
                      }

                      return page.evaluate(function() {
                        return document.getElementsByTagName('a')[0].href;
                      });
                    })
                    .then(function(newLocal) {
                      console.log('redirecting to ' + newLocal);
                      return page.open(newLocal);
                    })
                    .then(function(status) {
                      return RsvpService.waitForPageLoad(3500, status);
                    });
                }

                return pageOpenPromise;
              })
              .then(function(status) {
                if (status !== 'success') {
                  return Promise.reject(new PageOpenError('something happened trying to open redirect page'));
                }

                // click register button
                return page.evaluate(function() {
                    return document.querySelectorAll('a.js-ticket-modal-btn').length > 0;
                  })
                  .then(function(hasRegisterBtn) {
                    if (!hasRegisterBtn) {
                      return Promise.reject(new EventClosedError('Doesnt have a register btn. Prob closed event.'));
                    }

                    return page.evaluate(function() {
                      return document.querySelectorAll('a.js-ticket-modal-btn')[0].click();
                    });
                  });
              })
              .then(function() {
                return RsvpService.waitForPageLoad(500);
              })
              .then(function() {
                // click checkout to go to signup form
                // should have "1" select for qty.
                return page.evaluate(function() {
                    return document.querySelectorAll('input[type=submit][value=Checkout]').length > 0;
                  })
                  .then(function(hasCheckoutBtn) {
                    if (!hasCheckoutBtn) {
                      return Promise.reject(new EventClosedError('Doesnt have a checkout btn.'));
                    }

                    return page.evaluate(function() {
                      return document.querySelectorAll('input[type=submit][value=Checkout]')[0].click();
                    });
                  });
              })
              .then(function() {
                return RsvpService.waitForPageLoad(4500);
              })
              .then(function() {
                var firstNamePromise = page.evaluate(function() {
                    return document.querySelectorAll('input#first_name.required').length > 0;
                  })
                  .then(function(hasFirstNameField) {
                    if (!hasFirstNameField) {
                      return Promise.reject(new EventClosedError('Doesnt have first name field.'));
                    }

                    //fill in first name
                    return page.evaluate(function(firstName) {
                      return document.querySelectorAll('input#first_name.required')[0].value = firstName;
                    }, firstName);
                  });

                var lastNamePromise = page.evaluate(function() {
                    return document.querySelectorAll('input#last_name.required').length > 0;
                  })
                  .then(function(hasLastNameField) {
                    if (!hasLastNameField) {
                      return Promise.reject(new EventClosedError('Doesnt have last name field.'));
                    }

                    //fill in last name
                    return page.evaluate(function(lastName) {
                      return document.querySelectorAll('input#last_name.required')[0].value = lastName;
                    }, lastName)
                  });

                var emailPromise = page.evaluate(function() {
                    return document.querySelectorAll('input#email_address.required').length > 0;
                  })
                  .then(function(hasEmailField) {
                    if (!hasEmailField) {
                      return Promise.reject(new EventClosedError('Doesnt have email field.'));
                    }

                    //fill in email
                    return page.evaluate(function(email) {
                      return document.querySelectorAll('input#email_address.required')[0].value = email;
                    }, email);
                  });

                var confirmEmailPromise = page.evaluate(function() {
                    return document.querySelectorAll('input#confirm_email_address.required').length > 0;
                  })
                  .then(function(hasConfirmEmailField) {
                    if (!hasConfirmEmailField) {
                      return Promise.reject(new EventClosedError('Doesnt have confirm email field.'));
                    }

                    //fill in confirm email
                    return page.evaluate(function(email) {
                      return document.querySelectorAll('input#confirm_email_address.required')[0].value = email;
                    }, email);
                  });

                return Promise.join(firstNamePromise, lastNamePromise, emailPromise, confirmEmailPromise);
              })
              .then(function() {
                //submit form
                return page.evaluate(function() {
                    return document.querySelectorAll('span.button_checkout a[data-automation=complete_registration_button]').length > 0;
                  })
                  .then(function(hasCompleteBtn) {
                    if (!hasCompleteBtn) {
                      return Promise.reject(new EventClosedError('Doesnt have a complete btn.'));
                    }

                    return page.evaluate(function() {
                      return document.querySelectorAll('span.button_checkout a[data-automation=complete_registration_button]')[0].click();
                    });
                  });
              })
              .then(function() {
                return new Promise(function(resolve, reject) {
                  // allow time to process request
                  setTimeout(function() {
                    page.render('screenshots/ ' + eventName.replace(/ /g, '-') + '-rsvp.jpeg', {format: 'jpeg', quality: '60'});

                    console.log('closing browser.');
                    ph.exit();

                    resolve({
                      registered: REGISTERED,
                      msg: null
                    });

                  }, 3500);
                });
              })
              .catch(function(err) {
                console.log(err);
                page.render('screenshots/ errors/ error-' + eventName.replace(/ /g, '-') + '-rsvp.jpeg', {format: 'jpeg', quality: '60'});

                console.log('closing browser.');
                ph.exit();

                if (err instanceof EventClosedError || err instanceof PageOpenError) {
                  // we want to to resolve promise and continue on to the next one.
                  // do not want to reject all of them due to this
                  return Promise.resolve({
                    registered: NOT_REGISTERED,
                    msg: err.message
                  });
                } else {
                  return Promise.reject(err);
                }
              });
          });
      });
  };

  return {
    eventbriteRsvp: eventbriteRsvp,
    waitForPageLoad: waitForPageLoad,
    // expose constants
    NOT_REGISTERED: NOT_REGISTERED,
    REGISTERED: REGISTERED
  };

})();

module.exports = RsvpService;
