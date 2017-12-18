/* --------------------------------------------------------------------------------------------
 * Copyright multiple authors.
 * See ../LICENSE for license information.
 ------------------------------------------------------------------------------------------
 */

/**
 * Implements the [language server protocol][1] v3.0 for Web Components and
 * Polymer.
 *
 * Communicates over stdin/stdout.
 *
 * [1]: https://github.com/Microsoft/language-server-protocol
 */
async function main() {
  // This import *must* come before all others.
  await import('./intercept-logs');
  //

  const {createConnection} = await import('vscode-languageserver');
  const {default: LanguageServer} =
      await import('./language-server/language-server');

  // Create a connection for the server. Communicate using stdio.
  let connection = createConnection(process.stdin, process.stdout);

  const serverPromise = LanguageServer.initializeWithConnection(connection);

  connection.listen();

  await serverPromise;
}

const version = require('../package.json').version;
if (process.argv.includes('--help')) {
  console.log(`Usage: polymer-editor-service

    Polymer Editor Service v${version}

    Speaks the Language Server Protocol over stdin/stdout.
    Hook it up to your editor, and configure it for HTML,
    JS, CSS, and JSON files.

    More info at https://github.com/Polymer/polymer-editor-service

Options:
  --help:     print this message
  --version:  print version
`);
} else if (process.argv.includes('--version')) {
  console.log(`Polymer Editor Service v${version}`);
} else {
  main().catch((err) => {
    console.error(`Failed to initialize polymer editor service:`);
    console.error(err);
    process.exitCode = 1;
  });
}
