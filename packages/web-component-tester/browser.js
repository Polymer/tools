(function () {
    'use strict';

    exports.__esModule = true;
    var wct_mocha_1 = require("wct-mocha");
    window['__useNpm'] = false;
    var environmentScripts = [
        'stacky/browser.js',
        'async/lib/async.js',
        'lodash/lodash.js',
        'mocha/mocha.js',
        'chai/chai.js',
        'sinonjs/sinon.js',
        'sinon-chai/lib/sinon-chai.js',
        'accessibility-developer-tools/dist/js/axs_testing.js'
    ];
    var environmentImports = ['test-fixture/test-fixture.html'];
    wct_mocha_1.initialize({ environmentScripts: environmentScripts, environmentImports: environmentImports });

}());
