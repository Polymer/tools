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
import * as path from 'path';
import * as send from 'send';
import * as url from 'url';

import { makeApp } from './make_app';

export interface ServerOptions {

  /** The root directory to serve **/
  root?: string;

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

function applyDefaultOptions(options: ServerOptions): ServerOptions {
  let withDefaults = Object.assign({}, options);
  Object.assign(withDefaults, {
    port: options.port || 8080,
    hostname: options.hostname || "localhost",
    root: path.resolve(options.root || '.'),
  });
  return withDefaults;
}

/**
 * @return {Promise} A Promise that completes when the server has started.
 */
export function startServer(options: ServerOptions): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    options = options || {};
    if (options.port) {
      resolve(options);
    } else {
      findPort(8080, 8180, (ports) => {
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

export function getApp(options: ServerOptions) {
  let port = options.port;
  let hostname = options.hostname;
  let root = options.root;

  let app = express();

  console.log(`Starting Polyserve...
    serving on port: ${port}
    from root: ${root}
  `);

  let polyserve = makeApp({
    componentDir: options.componentDir,
    packageName: options.packageName,
    root,
  });
  options.packageName = polyserve.packageName;

  app.use('/components/', polyserve);

  app.get('/*', (req, res) => {
    let filePath = req.path;
    send(req, filePath, {root: root,})
      .on('error', (error: send.SendError) => {
        if ((error).status == 404) {
          send(req, '/', {root: root}).pipe(res);
        } else {
          res.statusCode = error.status || 500;
          res.end(error.message);
        }
      })
      .pipe(res);
  });
  return app;
}

function startWithPort(userOptions: ServerOptions) {
  let options = applyDefaultOptions(userOptions);
  let app = getApp(options);
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

  let serverUrl = {
    protocol: 'http',
    hostname: options.hostname,
    port: `${options.port}`,
  };
  let componentUrl: url.Url = Object.assign({}, serverUrl);
  componentUrl.pathname = `components/${options.packageName}/`;

  console.log(`Files in this directory are available under the following URLs
    applications: ${url.format(serverUrl)}
    reusable components: ${url.format(componentUrl)}`);

  if (options.open) {
    componentUrl.pathname += options.open;
    let browsers = Array.isArray(options.browser)
      ? <Array<string>>options.browser
      : [options.browser];
    browsers.forEach((browser) => {
      opn(url.format(componentUrl), {app: browser});
    });
  }

  return serverStartedPromise;
}
