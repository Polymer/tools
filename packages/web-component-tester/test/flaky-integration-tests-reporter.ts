import {spawn} from 'child_process';
import * as Mocha from 'mocha';


const testGrepCount = parseInt(process.env['TEST_FAIL_COUNT'] + '', 10) || 0;
const testRunCount = parseInt(process.env['TEST_RUN_COUNT'] + '', 10) || 1;
const testRunMax = parseInt(process.env['TEST_RUN_MAX'] + '', 10) || 3;

module.exports =
    class FlakyIntegrationTestsReporter extends Mocha.reporters.Spec {
  constructor(runner: Mocha.Runner) {
    super(runner);
    const fails = new Set<string>();
    runner.on('fail', function(test: Mocha.Test, _error: Error) {
      const title = test.fullTitle().replace(/^".+" hook for "(.+)"/g, '$1');
      fails.add(title);
    });
    runner.on('end', function() {
      if (runner.stats.failures + runner.stats.passes < testGrepCount) {
        console.error('Failed to run intented number of tests.');
        process.exit(1);
      }
      if (fails.size === 0) {
        return;
      }
      if (testRunCount >= testRunMax) {
        console.error(
            `${testRunMax} attempts made, but still ` +
            `have ${runner.stats.failures} failure(s).`);
        return;
      }
      const args = process.argv.slice(1);
      process.execArgv.forEach((a) => args.push(a));
      const filteredArgs = [];
      for (let a = 0; a < args.length; ++a) {
        const arg = args[a];
        if (['--grep', '-g', '--fgrep', '-f'].includes(arg)) {
          ++a;
          continue;
        }
        if (['--grep=', '-g=', 'fgrep=', '-f='].some(
                (p) => arg.startsWith(p))) {
          continue;
        }
        filteredArgs.push(arg);
      }
      filteredArgs.push('--grep');
      filteredArgs.push([...fails].map(grepEscape).join('|'));

      console.error(
          `===\n` +
          `Test run produced ${runner.stats.failures} failure(s) ` +
          `on attempt #${testRunCount} out of ${testRunMax} limit.\n` +
          `Rerunning failed tests:\n` +
          [...fails].map((t) => ' - ' + t).join('\n') + `\n===\n`);

      runner.abort();

      spawn(process.argv0, filteredArgs, {
        env: Object.assign({}, process.env, {
          'TEST_GREP_COUNT': `${runner.stats.failures}`,
          'TEST_RUN_COUNT': `${testRunCount + 1}`,
        }),
        stdio: 'inherit',
      });
    });
  }
}

function grepEscape(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
