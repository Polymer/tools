/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// jshint node:true
'use strict';

var request = require('request');
var url = require('url');

function getFile(url, deferred) {
  request.get(url, function(err, response, body) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(body);
    }
  });
}

/*
 * Configuration:
 *   - host
 *      - Server hostname to match before making remote requests
 *      - Default: ""
 */
function URLResolver(config) {
  this.config = config;
}
URLResolver.prototype = {
  accept: function(uri, deferred) {
    var parsed = url.parse(uri);
    var host = parsed.hostname;

    if (parsed.host === this.config.host) {
      getFile(uri, deferred);
      return true;
    }

    return false;
  }
};

module.exports = URLResolver;
