/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
var _       = require('lodash');
var process = require('process');

var browsers = require('./browsers');
var selenium = require('./selenium');

/** WCT plugin that enables support for local browsers via Selenium. */
module.exports = function(wct) {

  // The capabilities objects for browsers to run.
  var eachCapabilities = [];

  // Convert any local browser names into Webdriver capabilities objects.
  //
  // Note that we run this hook late to allow other plugins to append their
  // browsers.
  wct.hookLate('configure', function(options, done) {
    // We support comma separated browser identifiers for convenience.
    var names = _.isArray(options.local) ? options.local : [options.local].join(',').split(',');
    // If the user did not specify _any_ other browsers, we default to running
    // all local browsers. Otherwise, we run nothing. Remember: This plugin is
    // always loaded when present.
    if (!names.length && options.activeBrowsers.length) return done();

    // Note that we **do not** append the browsers to `options.activeBrowsers`
    // until we've got a port chosen for the Selenium server.
    browsers.expand(names, function(error, expanded) {
      if (error) return done(error);
      wct.emit('log:debug', 'Expanded local browsers:', names, 'into capabilities:', expanded);
      eachCapabilities = expanded;
      done();
    });
  });

  wct.hook('prepare', function(options, done) {
    if (!eachCapabilities.length) return done();

    wct.emitHook('prepare:selenium', function(error) {
      if (error) return done(error);
      var port = options['selenium-port'] || parseInt(process.env.SELENIUM_PORT);
      // Is Selenium already running on a specified port?
      if (port) {
        appendBrowsers(wct, options, port, eachCapabilities);
        done();
      }

      // Nope. Gotta spin up our own.
      selenium.checkSeleniumEnvironment(function(error) {
        if (error) return done(error);
        selenium.startSeleniumServer(wct, function(error, port) {
          if (error) return done(error);
          appendBrowsers(wct, options, port, eachCapabilities);
          done();
        });
      });
    });

  });

};

// Utility

/**
 * @param {!wct.Context} wct
 * @param {!Object} options
 * @param {number} port
 * @param {!Array.<!Object>} eachCapabilities
 */
function appendBrowsers(wct, options, port, eachCapabilities) {
  eachCapabilities.forEach(function(capabilities) {
    capabilities.url = {
      hostname: '127.0.0.1',
      port:     port,
    };
  });

  wct.emit('log:debug', 'Appending local browsers:', eachCapabilities);
  options.activeBrowsers.push.apply(options.activeBrowsers, eachCapabilities);
}
