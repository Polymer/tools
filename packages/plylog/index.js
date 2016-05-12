/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';

const winston = require('winston');

class PolymerLogger {

  /**
   * Constructs a new instance of PolymerLogger. This creates a new internal
   * `winston` logger, which is what we use to handle most of our logging logic.
   *
   * @constructor
   * @param  {Object} [options]
   * @param  {string} [options.level] The minimum severity to log, defaults to 'info'
   * @return {void}
   */
  constructor(options) {
    options = options || {};

    let consoleTransport = new (winston.transports.Console)({
      level: options.level || 'info'
    });
    this._logger =  new (winston.Logger)({transports: [consoleTransport]});
    this._logger.cli();
  }

  /**
   * Sets a new logger level on the internal winston logger. The level dictates
   * the minimum level severity that you will log to the console.
   *
   * @param  {string} [newLevel] The new maximum severity that will be logged
   * @return {void}
   */
  setLevel(newLevel) {
    this._logger.transports.console.level = newLevel;
  }

  /**
   * Logs an ERROR message, if the log level allows it. These should be used
   * to give the user information about a serious error that occurred. Usually
   * used right before the process exits.
   *
   * @param  {string} msg The message to log
   * @param  {Object} [metadata] Optional metadata to log
   * @return {void}
   */
  error() {
    this._logger.error.apply(this._logger, arguments);
  }

  /**
   * Logs a WARN message, if the log level allows it. These should be used
   * to give the user information about some unexpected issue that was
   * encountered. Usually the process is able to continue, but the user should
   * still be concerned and hopefully investigate further.
   *
   * @param  {string} msg The message to log
   * @param  {Object} [metadata] Optional metadata to log
   * @return {void}
   */
  warn() {
    this._logger.warn.apply(this._logger, arguments);
  }

  /**
   * Logs an INFO message, if the log level allows it. These should be used
   * to give the user generatl information about the process, including progress
   * updates and status messages.
   *
   * @param  {string} msg The message to log
   * @param  {Object} [metadata] Optional metadata to log
   * @return {void}
   */
  info() {
    this._logger.info.apply(this._logger, arguments);
  }

  /**
   * Logs a DEBUG message, if the log level allows it. These should be used
   * to give the user useful information for debugging purposes. These will
   * generally only be displayed when the user is are troubleshooting an
   * issue.
   *
   * @param  {string} msg The message to log
   * @param  {Object} [metadata] Optional metadata to log
   * @return {void}
   */
  debug() {
    this._logger.debug.apply(this._logger, arguments);
  }

}

module.exports = PolymerLogger;
