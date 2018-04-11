/* --------------------------------------------------------------------------------------------
 * Copyright multiple authors.
 * See ../LICENSE for license information.
 ------------------------------------------------------------------------------------------
 */

import * as commandLineArgs from 'command-line-args';

const optionDescriptors = [
  {name: 'help', type: Boolean}, {name: 'version', type: Boolean},
  {name: 'logToFile', type: String},
  // these args are passed in by vscode by default, even though
  // we don't care about them right now we don't want to fail
  // if they're given.
  {name: 'stdio'}, {name: 'clientProcessId', type: Number}
];

interface Options {
  help?: boolean;
  version?: boolean;
  logToFile?: string;
}

const options = commandLineArgs(optionDescriptors, {});

/**
 * Implements the [language server protocol][1] v3.0 for Web Components and
 * Polymer.
 *
 * Communicates over stdin/stdout.
 *
 * [1]: https://github.com/Microsoft/language-server-protocol
 */
async function main(options: Options) {
  // This import *must* come before all others.
  await import('./intercept-logs');
  //

  const {createConnection} = await import('vscode-languageserver');
  const {default: LanguageServer} =
      await import('./language-server/language-server');

  // Create a connection for the server. Communicate using stdio.
  let connection = createConnection(process.stdin, process.stdout);

  const serverPromise = LanguageServer.initializeWithConnection(
      connection, {interceptConsole: true, logToFile: options.logToFile});

  connection.listen();

  await serverPromise;
}

const version = require('../package.json').version;
if (options.help) {
  console.log(`Usage: polymer-editor-service

    Polymer Editor Service v${version}

    Speaks the Language Server Protocol over stdin/stdout.
    Hook it up to your editor, and configure it for HTML,
    JS, CSS, and JSON files.

    More info at https://github.com/Polymer/polymer-editor-service

Options:
  --help:       print this message
  --version:    print version
  --logToFile:  append logs to the file at this path
`);
} else if (options.version) {
  console.log(`Polymer Editor Service v${version}`);
} else {
  main(options).catch((err) => {
    console.error(`Failed to initialize polymer editor service:`);
    console.error(err);
    process.exitCode = 1;
  });
}
