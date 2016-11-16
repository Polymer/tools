'use strict';

import * as path from 'path';
import {bowerConfig} from '../bower_config';
import {assert} from 'chai';

suite('bowerConfig', () => {

  test('reads bower.json', () => {
    let config = bowerConfig(path.join(__dirname, '..', '..', 'test'));
    assert.equal(config.name, 'polyserve-test');
  });

});
