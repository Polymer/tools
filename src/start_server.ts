/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

import * as express from 'express';
import * as findPort from 'find-port';
import * as http from 'http';
import * as opn from 'opn';
import { makeApp } from './make_app';

export interface ServerOptions {
  /** The port to serve from */
  port?: number;

  /** The hostname to serve from */
  hostname?: string;

  /** The page to open in the default browser on startup **/
  open?: boolean | string;

  /** The browser to open **/
  browser?: string | string[];

  /** The component directory to use **/
  componentDir?: string;

  /** The package name to use for the root directory **/
  packageName?: string;
}
/**
 * @return {Promise} A Promise that completes when the server has started.
 */
export function startServer(options: ServerOptions): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    if (options.port) {
      resolve(options);
    } else {
      findPort(8080, 8180, function(ports) {
        options.port = ports[0];
        resolve(options);
      });
    }
  }).then<http.Server>((opts) => startWithPort(opts));
}

const portInUseMessage = (port: number) => `
ERROR: Port in use: ${port}
Please choose another port, or let an unused port be chosen automatically.
`;

function startWithPort(options: ServerOptions) {

  options.port = options.port || 8080;
  options.hostname = options.hostname || "localhost";

  console.log('Starting Polyserve on port ' + options.port);

  let app = express();

  let polyserve = makeApp({
    componentDir: options.componentDir,
    packageName: options.packageName,
    root: process.cwd(),
  });

  app.get('/', function (req, res) {
    res.redirect(301, `/components/${polyserve.packageName}/`);
  });

  app.use('/components/', polyserve);

  let server = http.createServer(app);
  let serverStartedResolve: (r: any) => void;
  let serverStartedReject: (r: any) => void;
  let serverStartedPromise = new Promise((resolve, reject) => {
    serverStartedResolve = resolve;
    serverStartedReject = reject;
  });

  server = app.listen(options.port, options.hostname,
      () => serverStartedResolve(server));

  server.on('error', function(err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(portInUseMessage(options.port));
    }
    serverStartedReject(err);
  });

  let baseUrl = `http://${options.hostname}:${options.port}/components/${polyserve.packageName}/`;
  console.log(`Files in this directory are available under ${baseUrl}`);

  if (options.open) {
    console.log('browser', options.browser);
    let url = baseUrl + (options.open === true ? 'index.html' : options.open);
    let browsers = Array.isArray(options.browser)
      ? <Array<string>>options.browser
      : [options.browser];
    browsers.forEach((browser) => {
      opn(url, {app: browser});
    });
  }

  return serverStartedPromise;
}
