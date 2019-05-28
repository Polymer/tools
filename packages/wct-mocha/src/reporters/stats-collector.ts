'use strict';
/**
(The MIT License)

Copyright (c) 2011-2018 JS Foundation and contributors, https://js.foundation

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * The following was extracted from
 * https://github.com/mochajs/mocha/blob/master/lib/stats-collector.js
 */

/**
 * Test statistics collector.
 *
 * @typedef {Object} StatsCollector
 * @property {number} suites - integer count of suites run.
 * @property {number} tests - integer count of tests run.
 * @property {number} passes - integer count of passing tests.
 * @property {number} pending - integer count of pending tests.
 * @property {number} failures - integer count of failed tests.
 * @property {Date} start - time when testing began.
 * @property {Date} end - time when testing concluded.
 * @property {number} duration - number of msecs that testing took.
 */

/**
 * Provides stats such as test duration,
 * number of tests passed / failed etc.
 *
 * @public
 * @memberof Mocha
 * @param {Runner} runner
 */
export const createStatsCollector = (runner: Mocha.Runner) => {
  var stats:
      Mocha.Stats = {suites: 0, tests: 0, passes: 0, pending: 0, failures: 0};

  if (!runner) {
    throw new TypeError('Missing runner argument');
  }

  runner.stats = stats;

  runner.once('start', function() {
    stats.start = new Date();
  });

  runner.on('suite', function(suite) {
    suite.root || stats.suites++;
  });

  runner.on('pass', function() {
    stats.passes++;
  });

  runner.on('fail', function() {
    stats.failures++;
  });

  runner.on('pending', function() {
    stats.pending++;
  });

  runner.on('test end', function() {
    stats.tests++;
  });

  runner.once('end', function() {
    stats.end = new Date();
    // To coerce to numbers and make TS compiler happy, we use unary `+` prefix
    // for date arithmetic.
    stats.duration = +stats.end - +stats.start;
  });
}
