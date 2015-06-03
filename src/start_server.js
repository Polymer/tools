/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

var express = require('express');
var http = require('http');
var makeApp = require('./make_app');
var open = require('open');
var util = require('util');
var findPort = require('find-port');

function startServer(options) {
  if (!options.port) {
    findPort(8080, 8180, function(ports) {
      options.port = ports[0];
      startWithPort(options);
    });
  }
  else {
    startWithPort(options);
  }
}

/**
 * @param {Object} options
 * @param {Number} options.port -- port number
 * @param {String=} options.page -- page path, ex: "/", "/index.html"
 * @param {(String|String[])} options.browser -- names of browser apps to launch
 */
function startWithPort(options) {

  options.port = options.port || 8080;

  console.log('Starting Polyserve on port ' + options.port);

  var app = express();
  var polyserve = makeApp(options.componentDir, options.packageName);

  app.use('/components/', polyserve);

  var server = http.createServer(app);

  server = app.listen(options.port);

  server.on('error', function(err) {
    if (err.code === 'EADDRINUSE')
      console.error("ERROR: Port in use", options.port,
        "\nPlease choose another port, or let an unused port be chosen automatically.");
    process.exit(69);
  });

  var baseUrl = util.format('http://localhost:%d/components/%s/', options.port,
    polyserve.packageName);
  console.log('Files in this directory are available under ' + baseUrl);

  if (options.page) {
    var url = baseUrl + (options.page === true ? 'index.html' : options.page);
    if (Array.isArray(options.browser)) {
      for (var i = 0; i < options.browser.length; i++)
        open(url, options.browser[i]);
    }
    else {
      open(url, options.browser);
    }
  }
}

module.exports = startServer;
