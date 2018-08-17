import {initialize} from 'wct-mocha';

window['__useNpm'] = false;

const environmentScripts = [
  'stacky/browser.js',
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