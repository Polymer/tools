// @ts-check

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const inPath = 'src/analysis-format/analysis-format.ts';
const outPath = 'lib/analysis.schema.json';
const command = path.normalize(`node_modules/.bin/typescript-json-schema`);
try {
  fs.mkdirSync('lib');
} catch(e) { /* probably already exists, don't care */ }
const child = child_process.spawn(
    command,
    [`--required`, `--ignoreErrors`, `${inPath}`, `Analysis`],
    // @ts-ignore
    { shell: true, cwd: process.cwd(), hideWindows: true });
let buffer = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buffer += chunk;
});
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});
const childFinished = new Promise((resolve, reject) => {
  child.on('exit', (code) => {
    if (code === 0) {
      resolve();
    } else {
      reject();
    }
  });
});
childFinished.then(() => {
  fs.writeFileSync(outPath, buffer, 'utf8');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
