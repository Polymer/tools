"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const Mocha = require("mocha");
const path_1 = require("path");
function grepEscape(s) {
    return s.replace(/([^a-z0-9])/g, '\\$1');
}
module.exports =
    class FlakyIntegrationTestsReporter extends Mocha.reporters.Spec {
        constructor(runner) {
            super(runner);
            let failedTests = [];
            runner.on('fail', function (test, error) {
                failedTests.push({ test, error });
            });
            runner.on('end', function () {
                if (failedTests.length === 0) {
                    fs_1.writeFileSync(path_1.resolve('./rerun-failed-integration-tests.bash'), 'echo "No tests to rerun.  All tests passed."');
                    return;
                }
                fs_1.writeFileSync(path_1.resolve('./rerun-failed-integration-tests.bash'), `mocha "test/integration/**/*.js" --timeout 90000 --reporter "test/flaky-integration-tests-reporter.js" --grep "${failedTests.map((data) => grepEscape(data.test.fullTitle()))
                    .join('|')}"`); // decide if you want multiple retry case
                // here || bash
                // ./rerun-flaky-integration-tests.bash`);
            });
        }
    };
