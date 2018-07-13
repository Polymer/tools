/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */
/**
 * WCT-specific behavior on top of Mocha's default HTML reporter.
 *
 * @param {!Mocha.Runner} runner The runner that is being reported on.
 */
export default function HTML(runner) {
    var output = document.createElement('div');
    output.id = 'mocha';
    document.body.appendChild(output);
    runner.on('suite', function (_test) {
        this.total = runner.total;
    }.bind(this));
    Mocha.reporters.HTML.call(this, runner);
}
// Woo! What a hack. This just saves us from adding a bunch of complexity around
// style loading.
var style = document.createElement('style');
style.textContent = "\n    html, body {\n      position: relative;\n      height: 100%;\n      width:  100%;\n      min-width: 900px;\n    }\n    #mocha, #subsuites {\n      height: 100%;\n      position: absolute;\n      top: 0;\n    }\n    #mocha {\n      box-sizing: border-box;\n      margin: 0 !important;\n      padding: 60px 20px;\n      right: 0;\n      left: 500px;\n    }\n    #subsuites {\n      -ms-flex-direction: column;\n      -webkit-flex-direction: column;\n      display: -ms-flexbox;\n      display: -webkit-flex;\n      display: flex;\n      flex-direction: column;\n      left: 0;\n      width: 500px;\n    }\n    #subsuites .subsuite {\n      border: 0;\n      width: 100%;\n      height: 100%;\n    }\n    #mocha .test.pass .duration {\n      color: #555 !important;\n    }\n";
document.head.appendChild(style);
