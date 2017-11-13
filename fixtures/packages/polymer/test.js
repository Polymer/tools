const path = require('path');

module.exports = {
  options: ['--npm-name', '@polymer/polymer', '--npm-version', '3.0.0'],
  stdout: `[1/2] 🌀  Converting Package...
Out directory: ${path.join(__dirname, 'generated')}
[2/2] 🎉  Conversion Complete!`,
  stderr: ``,
};
