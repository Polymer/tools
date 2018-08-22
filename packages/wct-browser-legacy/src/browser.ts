import {initialize} from 'wct-mocha';
import * as replace from './replace';
import * as stub from './stub';

window['__useNpm'] = true;

const environmentScripts = [
  'async/lib/async.js',
  'lodash/index.js',
  'mocha/mocha.js',
  'chai/chai.js',
  '@polymer/sinonjs/sinon.js',
  'sinon-chai/lib/sinon-chai.js',
  'accessibility-developer-tools/dist/js/axs_testing.js',
  '@polymer/test-fixture/test-fixture.js'
];

initialize({environmentScripts});