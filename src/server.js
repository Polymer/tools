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
var fs = require('fs');
var http = require('http');
var path = require('path');
var parseUrl = require('url').parse;
var send = require('send');

function startServer(port) {
  port = port || 8080;
  console.log('Starting Polyserve on port ' + port);

  var app = express();
  var server = http.createServer(app);

  var bowerFile = fs.readFileSync('bower.json');
  var bowerJson = JSON.parse(bowerFile);
  var bowerPackageName = bowerJson.name;
  var bowerComponentDir = 'bower_components';

  console.log('Files in this directory are available at localhost:' +
      port + '/components/' + bowerPackageName + '/...');

  app.get('/component/*', function (req, res) {

    // Serve local files from . and other components from bower_components
    var url = parseUrl(req.url, true);
    var splitPath = url.pathname.split(path.sep).slice(2);
    splitPath = splitPath[0] == bowerPackageName
       ? splitPath.slice(1)
       : [bowerComponentDir].concat(splitPath);
    var filePath = splitPath.join(path.sep);

    send(req, filePath).pipe(res);
  });

  server = app.listen(port);
}

module.exports = {
  startServer: startServer
};
