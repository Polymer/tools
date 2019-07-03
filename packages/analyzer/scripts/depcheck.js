// @ts-check
const depcheck = require('depcheck');
const path = require('path');

const check = new Promise((resolve, reject) => {
    depcheck(
      path.join(__dirname, '..'),
      {
        ignoreDirs: ['src/test/static'], ignoreMatches: ['@types/*']
      },
      resolve);
  })
    .then((result) => {
      const invalidFiles = Object.keys(result.invalidFiles) || [];
      const invalidJsFiles = invalidFiles.filter((f) => f.endsWith('.js'));

      const unused = new Set(result.dependencies);
      if (unused.size > 0) {
        console.log('Unused dependencies:', unused);
        throw new Error('Unused dependencies');
      }
    });

check.catch((e) => {
  console.error(e);
  process.exit(1);
});
