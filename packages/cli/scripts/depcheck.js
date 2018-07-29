// @ts-check
const depcheck = require('depcheck');
const path = require('path');

const check = new Promise((resolve, reject) => {
    depcheck(
      path.join(__dirname, '..'),
      {
        ignoreMatches: [
          '@types/*',
          'vinyl',
          'babel-plugin-external-helpers',
          'polymer-bundler',
        ],
        ignoreDirs: [
          'templates',
        ],
      },
      resolve);
  })
  .then((result) => {
    let invalidFiles = Object.keys(result.invalidFiles) || [];
    let invalidJsFiles = invalidFiles.filter((f) => f.endsWith('.js'));
    if (invalidJsFiles.length > 0) {
      throw new Error(`Invalid files: ${invalidJsFiles}`);
    }
    if (result.dependencies.length) {
      throw new Error(`Unused dependencies: ${result.dependencies}`);
    }
  });

check.catch((e) => {
  console.error(e);
  process.exit(1);
});
