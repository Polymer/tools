import {ChildRunner, extendInterfaces, initialize} from 'wct-mocha';
import {replace} from 'wct-sinon/lib/replace';
import {stub} from 'wct-sinon/lib/stub';

extendInterfaces('replace', replace);
extendInterfaces('stub', stub);

window.__useNpm = false;

if (ChildRunner.current()) {
  initialize();
} else {
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
}