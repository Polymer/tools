/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
var cleankill = require('cleankill');
var freeport  = require('freeport');
var process   = require('process');
var selenium  = require('selenium-standalone');
var which     = require('which');

function checkSeleniumEnvironment(done) {
  which('java', function(error) {
    if (!error) return done();

    var message = 'java is not present on your PATH.';
    if (process.platform === 'win32') {
      message = message + '\n\n  Please install it: https://java.com/download/\n\n';
    } else if (process.platform === 'linux') {
      try {
        which.sync('apt-get');
        message = message + '\n\n  sudo apt-get install default-jre\n\n';
      } catch (error) {
        // There's not a clear default package for yum distros.
      }
    }

    done(message);
  });
}

function startSeleniumServer(emitter, done) {
  checkSeleniumEnvironment(function(error) {
    if (error) return done(error);
    freeport(function(error, port) {
      if (error) return done(error);

      var server = selenium({}, ['-port', port]);
      var badExit = function() { done('Could not start Selenium'); };
      server.on('exit', badExit);

      function onOutput(data) {
        var str = data.toString();
        emitter.emit('log:debug', str);

        if (str.indexOf('Started org.openqa.jetty.jetty.Server') > -1) {
          server.removeListener('exit', badExit);
          emitter.emit('log:info', 'Selenium server running on port', chalk.yellow(port));
          done(null, port);
        }
      }
      server.stdout.on('data', onOutput);
      server.stderr.on('data', onOutput);

      cleankill.onInterrupt(function(done) {
        server.kill();
        done();
      });
    });
  });
}

module.exports = {
  checkSeleniumEnvironment: checkSeleniumEnvironment,
  startSeleniumServer:      startSeleniumServer,
};
