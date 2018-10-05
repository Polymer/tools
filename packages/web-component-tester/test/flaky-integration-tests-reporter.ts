import {writeFileSync} from 'fs';
import * as Mocha from 'mocha';
import {resolve} from 'path';

function grepEscape(s: string): string {
  return s.replace(/([^a-z0-9])/g, '\\$1');
}

module.exports =
    class FlakyIntegrationTestsReporter extends Mocha.reporters.Spec {
  constructor(runner: Mocha.Runner) {
    super(runner);

    let failedTests: {test: Mocha.Test, error: Error}[] = [];

    runner.on('fail', function(test: Mocha.Test, error: Error) {
      failedTests.push({test, error});
    });

    runner.on('end', function() {
      if (failedTests.length === 0) {
        writeFileSync(
            resolve('./rerun-failed-integration-tests.bash'),
            'echo "No tests to rerun.  All tests passed."');
        return;
      }
      writeFileSync(
          resolve('./rerun-failed-integration-tests.bash'),
          `mocha "test/integration/**/*.js" --timeout 90000 --reporter "test/flaky-integration-tests-reporter.js" --grep "${
              failedTests.map((data) => grepEscape(data.test.fullTitle()))
                  .join('|')}"`);  // decide if you want multiple retry case
                                   // here || bash
                                   // ./rerun-flaky-integration-tests.bash`);
    });
  }
}
