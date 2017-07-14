const fs = require('fs');
const path = require('path');
var diff = require('diff');
var chalk = require('chalk');
const {configureAnalyzer, configureConverter} = require('../lib/convert-package');

const fixturesDirPath = path.resolve(__dirname, '../fixtures');

function rework(line) {
  if (!line) {
    return null;
  }
  switch (line[0]) {
    case '@': return null;
    case '\\': return null;
    case '+': return '  ' + chalk.green(line);
    case '-': return '  ' + chalk.red(line);
    case ' ': return '  ' + line;
    default: return '  ' + line;
  }
}

(async function() {
  const expectedDir = path.join(fixturesDirPath, 'polymer_expected');
  let exitCode = 0;

  try {
    console.assert(fs.statSync(expectedDir).isDirectory());
  } catch (err) {
    console.log('Error: No checkpoint found, run `yarn run polymer:checkpoint` to generate a good checkpoint to compare against.');
    process.exit(1);
  }

  const analyzer = configureAnalyzer({
    inDir: path.join(fixturesDirPath, 'polymer'),
  });
  const analysis = await analyzer.analyzePackage();
  const converter = configureConverter(analysis, {});
  const resultsUnsorted = await converter.convert();
  const results = [...resultsUnsorted.entries()].sort((a, b) => {
    const aPath = a[0];
    const bPath = b[0];
    return aPath.localeCompare(bPath);
  });
  for (const [jsPath, jsContents] of results) {
    const expectedJsPath = path.resolve(expectedDir, jsPath);
    const expectedJsContents = fs.readFileSync(expectedJsPath, 'utf8');

    var patch = diff.createPatch('string', jsContents, expectedJsContents);
    var lines = patch.split('\n').slice(4).map(rework).filter(Boolean);
    if (lines.length === 0) {
      console.log(chalk.dim('✓ ' + jsPath));
    } else {
      exitCode = 1;
      console.log(chalk.bold.red('✕ ' + jsPath));
      console.log('');
      console.log(lines.join('\n'));
      console.log('');
    }
  }
  console.log('');

  process.exit(exitCode);
})();