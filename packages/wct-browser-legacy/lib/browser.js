"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wct_mocha_1 = require("wct-mocha");
const replace_1 = require("./replace");
const stub_1 = require("./stub");
window['__useNpm'] = true;
wct_mocha_1.extendInterfaces('replace', replace_1.replace);
wct_mocha_1.extendInterfaces('stub', stub_1.stub);
if (wct_mocha_1.ChildRunner.current()) {
    wct_mocha_1.initialize();
}
else {
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
    wct_mocha_1.initialize({ environmentScripts });
}
//# sourceMappingURL=browser.js.map