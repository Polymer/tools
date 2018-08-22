import {initialize} from 'wct-mocha';
import * as replace from 'wct-browser-legacy/lib/replace';
import * as stub from 'wct-browser-legacy/lib/stub';

window.__useNpm = false;

const environmentScripts = [
  'async/lib/async.js',
  'lodash/lodash.js',
  'mocha/mocha.js',
  'chai/chai.js',
  'sinonjs/sinon.js',
  'sinon-chai/lib/sinon-chai.js',
  'accessibility-developer-tools/dist/js/axs_testing.js'
];

const environmentImports = ['test-fixture/test-fixture.html'];

initialize({environmentScripts, environmentImports});
