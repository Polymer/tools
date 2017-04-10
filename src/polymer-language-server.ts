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

// This import *must* come before all others.
import './intercept-logs';
//

import {createConnection, IConnection} from 'vscode-languageserver';
import LanguageServer from './language-server/language-server';

// Create a connection for the server. Communicate using stdio.
let connection: IConnection = createConnection(process.stdin, process.stdout);


LanguageServer.initializeWithConnection(connection);

connection.listen();
