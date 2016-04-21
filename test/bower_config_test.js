'use strict';

const bowerConfig = require('../lib/bower_config').bowerConfig;
const assert = require('chai').assert;

suite('bowerConfig', () => {

  test('reads bower.json', () => {
    let config = bowerConfig(__dirname);
    assert.equal(config.name, 'polyserve-test');
  });

});
