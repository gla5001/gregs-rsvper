/**
 * Copyright 2016 Greg Alexander
 */

/**
 * A Cli to auto rsvp to events
 *
 * @constructor
 */
var Scraper = (function() {
  'use strict';

  // 3rd party modules
  var cheerio = require('cheerio'),
    Promise = require('bluebird'),
    request = require('request'),
    _ = require('lodash'),
    FS = require("q-io/fs"),
    // Node Modules
    path = require('path'),
    // Scraper modules
    RsvpService = require('../../services/lib/RsvpService');

  //constants
  var GOOGLE_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/u/1/d/1aTidsOZp9vZnNUHPKaetrsbNJiJKoV80LgRKXLF9zIE/pubhtml#',
    //div:first-child should be the master list. if there is no 'master' list, remove :first-child constraint and get all divs.
    GOOGLE_SHEETS_MASTER_LIST_DIV = '#sheets-viewport > div:first-child',
    GOOGLE_MASTER_LIST_ROWS = '.ritz.grid-container table tr',
    GOOGLE_LINK_COLUMN = 'td.s11',
    GOOGLE_DATA_COLUMN = 'td.s5',
    EVENTBRITE = 'eventbrite',
    DO_512 = 'do512',
    OTHER = 'other';

  /**
   * Constructor function for CLI.
   *
   * @param {Object} params - The parameters object.
   * @param {String} params.email - The rsvp'er email.
   * @param {String} params.firstName - The rsvp'er first name.
   * @param {String} params.lastName - The rsvp'er last name.
   *
   * @returns {Scraper} - A new instance of Scraper.
   */
  var Scraper = function(params) {
    if (!params.email) {
      throw new Error('email is required!');
    }

    if (!params.firstName) {
      throw new Error('firstname is required!');
    }

    if (!params.lastName) {
      throw new Error('lastname is required!');
    }

    // create properties
    Object.defineProperties(this, {
      'email': {
        enumerable: true,
        value: params.email
      },
      'firstName': {
        enumerable: true,
        value: params.firstName
      },
      'lastName': {
        enumerable: true,
        value: params.lastName
      }
    });
  };  

  Scraper.prototype.name = 'Scraper';

  /**
   * Generate the list of events to rsvp to.
   * Scrapes google doc to generate the list
   *
   * @returns {Promise} - A promise that resolves to a list of events.
   *  eventObj = {
   *     event: event name,
   *     url: rsvp link,
   *     date: date,
   *     venue: venue name,
   *     type: rsvp type
   *  }
   */
  Scraper.prototype.getURLList = function() {
    var self = this;

    return new Promise(function (resolve, reject) {
      request(GOOGLE_SPREADSHEET_URL, function(error, response, html){
          var events = [],
            $, link, event, date, venue, type,
            rowColumns;

          if(error){
            console.log(error);
            reject(error);
          }

          // load body into cheerio library which will essentially give us jQuery functionality
          $ = cheerio.load(html);
          
          // params: selector, [context]
          $(GOOGLE_MASTER_LIST_ROWS, GOOGLE_SHEETS_MASTER_LIST_DIV).each(function(index, element) {
            rowColumns = $(element).children(GOOGLE_LINK_COLUMN);
            // theres a link
            if (rowColumns.contents().length > 0 && rowColumns.children('a').length > 0) {
              event = rowColumns.children('a').text();
              link = rowColumns.children('a').prop('href');

              if (link.indexOf(EVENTBRITE) > -1) {
                type = EVENTBRITE;
              } else if (link.indexOf(DO_512) > -1) {
                type = DO_512;
              } else {
                type = OTHER;
              }

              $(element).children(GOOGLE_DATA_COLUMN).each(function(index, element) {
                if (index === 0) {
                  date = $(element).text() || 'No date found :(';
                } else if (index === 1) {
                  venue = $(element).text() || 'TBD';
                }
              });

              events.push({
                event: event,
                url: link,
                date: date,
                venue: venue,
                type: type
              });
            }
          });

          resolve(events);
      });
    });

  };

  /**
   * Generate a csv file of the results and write to disk.
   * NOTE: file path is hardcoded at this point. WILL CHANGE
   *
   * @returns {Promise} - A promise that resolves when the results csv file is written.
   */
  Scraper.prototype.writeResultsCsv = function(results) {
    var headerNames = ['name', 'date', 'venue', 'url', 'result', 'error_message'],
      csvText = '';

    // Helper function
    function transformArrayToCsvValues(array) {
      var returnArray = [];
      array.forEach(function(ele) {
        if (!_.isObject(ele)) {
          if (ele === null || ele === undefined) {
            ele = '';
          } else {
            ele = ele.toString();
          }
          returnArray.push('"' + ele.replace(/"/g, '""') + '"');
        }
      });
      return returnArray;
    }

    csvText += transformArrayToCsvValues(headerNames) + '\n';
    results.forEach(function(result) {
      var values = [
          result.event || '',
          result.date || '',
          result.venue || '',
          result.url || '',
          result.result || '',
          result.msg || ''
        ];
      csvText += transformArrayToCsvValues(values) + '\n';
    });

    // TODO: dont hard code file path. CHANGE
    return FS.write('/Users/alexag1/Downloads/results.csv', csvText);
  };

  /**
   * Begins the rsvp'ing process
   *
   * @returns {Promise} - A promise that resolves when scraping and rsvp'ing is complete.
   */
  Scraper.prototype.scrape = function() {
    var self = this,
      totalEvents = 0,
      eventbriteCount = 0,
      do512count = 0;
    
    return self.getURLList()
      .then(function(events) {
        totalEvents = events.length;

        return Promise.map(events, function(event) {
            var rsvpPromise;

            event.firstName = self.firstName;
            event.lastName = self.lastName;
            event.email = self.email;

            if (event.type === EVENTBRITE) {
              eventbriteCount++;
              rsvpPromise = RsvpService.eventbriteRsvp(event);
            } else if (event.type === DO_512) {
              // Cant rsvp to these, site uses captcha :(
              do512count++;
              rsvpPromise = Promise.resolve({
                registered: RsvpService.NOT_REGISTERED,
                msg: 'Theres a captcha. Cant submit form'
              });
            } else {
              rsvpPromise = Promise.resolve({
                registered: RsvpService.NOT_REGISTERED,
                msg: 'Not an eventbrite or do512 rsvp. havent figured out yet'
              });
            }

            return rsvpPromise
              .then(function(result) {
                  return {
                    event: event.event,
                    date: event.date,
                    venue: event.venue,
                    url: event.url,
                    result: (event.registered === RsvpService.REGISTERED) ? 'Y': 'N',
                    msg: result.msg || null
                  };
              });
          }, {
            concurrency: 10
          })
          .then(function(results) {
            console.log('Total events: ' + totalEvents + '\n' + 'Eventbrite events: ' + eventbriteCount + '\n' + 'Do512 events: ' + do512count);
            return self.writeResultsCsv(results);
          });
      })
      .catch(function(error) {
        console.log(error);
      });
  };

  return Scraper;
})();

// Export the class definition
module.exports = Scraper;

/**
 * The following is executed when this file is run from the command line.
 */
(function() {
  'use strict';

  if (require.main === module) {
    // parse command line args
    var argv = require('optimist')
      .usage('Usage: node ' + __filename + ' --email --firstName --lastName')
      .alias('e', 'email')
      .describe('e', 'The email of the rsvp\'er')
      .demand('email')
      .string('email')
      .alias('f', 'firstName')
      .describe('f', 'The first name of the rsvp\'er')
      .demand('firstName')
      .string('firstName')
      .alias('l', 'lastName')
      .describe('l', 'The last name of the rsvp\'er')
      .demand('lastName')
      .string('lastName')
      .parse(process.argv);

    console.log('Args:', (process.argv) ? process.argv.join() : 'undefined');


    // create an instance of Scraper and run it
    new Scraper(argv)
      .scrape()
      .then(function() {
        console.log('All Done!');
      })
      .catch(function(error) {
        console.error('Error: %s', error);
      });
  }
})();


