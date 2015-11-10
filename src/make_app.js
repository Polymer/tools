/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const parseUrl = require('url').parse;
const send = require('send');
const bowerConfig = require('./bower_config');

/**
 * Make a polyserve express app.
 * @param  {Object} options
 * @param  {string} options.componentDir The directory to serve components from.
 * @param  {string} options.packageName A name for this polyserve package.
 * @param  {Object} options.headers An object keyed by header name containing
 *         header values.
 * @param  {string} options.root The root directory to serve a package from
 * @return {Object} An express app which can be served with `app.get`
 */
function makeApp(options) {

  let root = options.root;
  let componentDir = options.componentDir || 'bower_components';
  let packageName = options.packageName || bowerConfig(root).name
      || path.basename(process.cwd());
  let headers = options.headers || {};

  let app = express();

  app.get('*', function (req, res) {
    // Serve local files from . and other components from bower_components
    let url = parseUrl(req.url, true);
    let splitPath = url.pathname.split('/').slice(1);

    if (splitPath[0] === packageName) {
      if (root) {
        splitPath = [root].concat(splitPath.slice(1));
      } else {
        splitPath = splitPath.slice(1);
      }
    } else {
      splitPath = [componentDir].concat(splitPath);
    }
    let filePath = splitPath.join('/');
    console.log('filePath', filePath);

    if (headers) {
      for (let header in headers) {
        res.append(header, headers[header]);
      }
    }
    send(req, filePath).pipe(res);
  });
  app.packageName = packageName;
  return app;
}

module.exports = makeApp;
