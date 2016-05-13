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
const assert = require('chai').assert;
const sinon = require('sinon');
const logging = require('../index.js');

suite('plylog', () => {

  suite('getLogger()', () => {

    test('creates an internal winston logger with the given logger when instantiated', () => {
      let logger = logging.getLogger('TEST_LOGGER');
      assert.instanceOf(logger._logger, winston.Logger);
    });

  });

  suite('setVerbose()', () => {

    test('sets the level of all future loggers to "debug"', () => {
      logging.setVerbose();
      let logger = logging.getLogger('TEST_LOGGER');
      assert.equal(logger._logger.transports.console.level, 'debug');
    });

  });

  suite('setQuiet()', () => {

    test('sets the level of all future loggers to "error"', () => {
      logging.setQuiet();
      let logger = logging.getLogger('TEST_LOGGER');
      assert.equal(logger._logger.transports.console.level, 'error');
    });

  });

  suite('PolymerLogger instance', () => {

    test('changes its internal logger\'s level when level property is changed', () => {
      let logger = logging.getLogger('TEST_LOGGER');
      logger.level = 'info';
      assert.equal(logger._logger.transports.console.level, 'info');
      logger.level = 'debug';
      assert.equal(logger._logger.transports.console.level, 'debug');
     });

    test('reads its internal logger\'s level when the level property is read', () => {
      let logger = logging.getLogger('TEST_LOGGER');
      logger.level = 'silly';
      assert.equal(logger._logger.transports.console.level, 'silly');
      assert.equal(logger.level, 'silly');
     });

    test('loggers properly pass arguments to their internal logger\'s log methods when called', () => {
      let logger = logging.getLogger('TEST_LOGGER');
      let winstonSpy = sinon.spy(logger._logger, 'log');
      logger.debug('hello:debug');
      assert.isOk(winstonSpy.calledWith('debug', 'hello:debug'));
      logger.info('hello:info');
      assert.isOk(winstonSpy.calledWith('info', 'hello:info'));
      logger.warn('hello:warn');
      assert.isOk(winstonSpy.calledWith('warn', 'hello:warn'));
      logger.error('hello:error', {metadata: 'foobar'});
      assert.isOk(winstonSpy.calledWithMatch('error', 'hello:error', {metadata: 'foobar'}));
    });

  });

});
