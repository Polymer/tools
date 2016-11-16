/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

/// <reference path="../custom_typings/spdy.d.ts" />

import * as assert from 'assert';
import * as express from 'express';
import * as mime from 'mime';
import * as fs from 'mz/fs';
import * as path from 'path';
import * as pem from 'pem';
import * as send from 'send';
// TODO: Switch to node-http2 when compatible with express
// https://github.com/molnarg/node-http2/issues/100
import * as http from 'spdy';
import * as url from 'url';

import {makeApp} from './make_app';

import findPort = require('find-port');
import opn = require('opn');

/** h2 push manifest cache */
let _pushManifest = {};

export interface ServerOptions {
  /** The root directory to serve **/
  root?: string;

  /** The port to serve from */
  port?: number;

  /** The hostname to serve from */
  hostname?: string;

  /** Whether to open the browser when run **/
  open?: boolean;

  /** The browser(s) to open when run with open argument **/
  browser?: string[];

  /** The URL path to open in each browser **/
  openPath?: string;

  /** The component directory to use **/
  componentDir?: string;

  /** The package name to use for the root directory **/
  packageName?: string;

  /** The HTTP protocol to use */
  protocol?: string;

  /** Path to TLS service key for HTTPS */
  keyPath?: string;

  /** Path to TLS certificate for HTTPS */
  certPath?: string;

  /** Path to H2 push-manifest file */
  pushManifestPath?: string;
}

async function applyDefaultOptions(options: ServerOptions):
    Promise<ServerOptions> {
      const withDefaults = Object.assign({}, options);
      Object.assign(withDefaults, {
        port: await nextOpenPort(options.port),
        hostname: options.hostname || 'localhost',
        root: path.resolve(options.root || '.'),
        certPath: options.certPath || 'cert.pem',
        keyPath: options.keyPath || 'key.pem',
      });
      return withDefaults;
    }

/**
 * If port unspecified/negative, finds an open port on localhost
 * @param {number} port
 * @returns {Promise<number>} Promise of open port
 */
async function nextOpenPort(port: number):
    Promise<number> {
      if (!port || port < 0) {
        port = await new Promise<number>(resolve => {
          // TODO: Switch from `find-port` to `get-port`. `find-port` always
          // resolves a port number even if none are available. The error-event
          // handler in `startWithPort` catches the issue.
          findPort(8080, 8180, (ports: number[]) => {
            resolve(ports[0]);
          });
        });
      }
      return port;
    }

/**
 * @return {Promise} A Promise that completes when the server has started.
 */
export async function startServer(options: ServerOptions):
    Promise<http.Server> {
      options = options || {};
      assertNodeVersion(options);
      try {
        return await startWithPort(options)
      } catch (e) {
        console.error('ERROR: Server failed to start:', e);
        throw new Error(e);
      }
    }

const portInUseMessage = (port: number) => `
ERROR: Port in use: ${port}
Please choose another port, or let an unused port be chosen automatically.
`;

export function getApp(options: ServerOptions): express.Express {
  // Preload the h2-push manifest to avoid the cost on first push
  if (options.pushManifestPath) {
    getPushManifest(options.root, options.pushManifestPath);
  }

  const port = options.port;
  const root = options.root;
  const app = express();

  console.log(`Starting Polyserve...
    serving on port: ${port}
    from root: ${root}
  `);

  const polyserve = makeApp({
    componentDir: options.componentDir,
    packageName: options.packageName, root,
  });
  options.packageName = polyserve.packageName;

  const filePathRegex: RegExp = /.*\/.+\..{1,}$/;

  app.use('/components/', polyserve);

  app.get('/*', (req, res) => {
    pushResources(options, req, res);
    const filePath = req.path;
    send(req, filePath, {root: root})
        .on('error',
            (error: send.SendError) => {
              if ((error).status == 404 && !filePathRegex.test(filePath)) {
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

/**
 * Open the given web page URL. If no browser keyword is provided, `opn` will
 * use
 * the user's default browser.
 */
function openWebPage(url: string, withBrowser?: string) {
  const openOptions = {app: withBrowser};
  opn(url, openOptions, (err) => {
    if (err) {
      // log error and continue
      console.error(
          `ERROR: Problem launching "${openOptions.app || 'default web browser'
                                                          }".`);
    }
  });
}

/**
 * Opens a browser
 * @param options
 * @param serverUrl
 * @param componentUrl
 */
function openBrowser(
    options: ServerOptions, serverUrl: Object, componentUrl: url.Url) {
  if (options.open) {
    let openUrl: url.Url;
    if (options.openPath) {
      openUrl = Object.assign({}, serverUrl);
      openUrl.pathname = options.openPath;
    } else {
      openUrl = Object.assign({}, componentUrl);
    }
    if (!Array.isArray(options.browser)) {
      openWebPage(url.format(openUrl));
    } else {
      options.browser.forEach((browser) => {
        openWebPage(url.format(openUrl), browser);
      });
    }
  }
}

/**
 * Determines whether a protocol requires HTTPS
 * @param {string} protocol Protocol to evaluate.
 * @returns {boolean}
 */
function isHttps(protocol: string): boolean {
  return ['https/1.1', 'https', 'h2'].indexOf(protocol) > -1;
}

/**
 * Gets the URLs for the main and component pages
 * @param {ServerOptions} options
 * @returns {{serverUrl: {protocol: string, hostname: string, port: string},
 * componentUrl: url.Url}}
 */
function getServerUrls(options: ServerOptions) {
  const serverUrl = {
    protocol: isHttps(options.protocol) ? 'https' : 'http',
    hostname: options.hostname,
    port: `${options.port}`,
  };
  const componentUrl: url.Url = Object.assign({}, serverUrl);
  componentUrl.pathname = `components/${options.packageName}/`;
  return {serverUrl, componentUrl};
}

/**
 * Handles server-ready tasks (prints URLs and opens browser)
 * @param {ServerOptions} options
 */
function handleServerReady(options: ServerOptions) {
  const urls = getServerUrls(options);
  console.log(`Files in this directory are available under the following URLs
    applications: ${url
                  .format(urls.serverUrl)}
    reusable components: ${url.format(urls.componentUrl)}`);
  openBrowser(options, urls.serverUrl, urls.componentUrl);
}

/**
 * Generates a TLS certificate for HTTPS
 * @returns {Promise<{}>} Promise of {key: string, cert: string}
 */
async function createTLSCertificate(): Promise<{
  key: string, cert: string
}> {
  const keys: any = await new Promise((resolve, reject) => {
    console.log('Generating TLS certificate...');
    pem.createCertificate(
        {days: 365, selfSigned: true}, (err: any, keys: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(keys);
          }
        });
  });

  return {
    cert: keys.certificate,
    key: keys.serviceKey,
  };
}

/**
 * Gets the current TLS certificate (from current directory)
 * or generates one if needed
 * @param {string} keyPath path to TLS service key
 * @param {string} certPath path to TLS certificate
 * @returns {Promise<{}>} Promise of {key: string, cert: string}
 */
async function getTLSCertificate(keyPath: string, certPath: string): Promise<{
  key: string, cert: string
}> {
  let certObj: {cert: string, key: string};

  if (keyPath && certPath) {
    // TODO: Simplify code with ES6 destructuring when TypeScript 2.1 arrives.
    //
    // While TypeScript 2.0 already supports it, tsc does not transpile
    // async/await
    // to ES5, which is scheduled for TypeScript 2.1. The advantages of
    // async/await
    // outweigh that of array destructuring, so go the verbose way for now...

    try {
      const certData = await Promise.all([
        fs.readFile(certPath).then((value: Buffer) => value.toString().trim()),
        fs.readFile(keyPath).then((value: Buffer) => value.toString().trim())
      ]);
      const cert: string = certData[0];
      const key: string = certData[1];
      if (key && cert) {
        certObj = {
          cert: cert,
          key: key,
        };
      }
    } catch (err) {
      // If the cert/key file doesn't exist, generate new TLS certificate
      if (err.code !== 'ENOENT') {
        throw new Error(`cannot read certificate ${err}`);
      }
    }
  }

  if (!certObj) {
    certObj = await createTLSCertificate();

    if (keyPath && certPath) {
      await Promise.all([
        fs.writeFile(certPath, certObj.cert),
        fs.writeFile(keyPath, certObj.key)
      ]);
    }
  }

  return certObj;
}

/**
 * Asserts that Node version is valid for h2 protocol
 * @param {ServerOptions} options
 */
function assertNodeVersion(options: ServerOptions) {
  if (options.protocol === 'h2') {
    const matches = /(\d+)\./.exec(process.version);
    if (matches) {
      const major = Number(matches[1]);
      assert(
          major >= 5,
          'h2 requires ALPN which is only supported in node.js >= 5.0');
    }
  }
}

/**
 * Creates an HTTP(S) server
 * @param app
 * @param {ServerOptions} options
 * @returns {Promise<http.Server>} Promise of server
 */
async function createServer(app: any, options: ServerOptions):
    Promise<http.Server> {
      const opt: any = {spdy: {protocols: [options.protocol]}};

      if (isHttps(options.protocol)) {
        const keys = await getTLSCertificate(options.keyPath, options.certPath);
        opt.key = keys.key;
        opt.cert = keys.cert;
      } else {
        opt.spdy.plain = true;
        opt.spdy.ssl = false;
      }

      return http.createServer(opt, app);
    }

/**
 * Starts an HTTP(S) server on a specific port
 * @param {ServerOptions} userOptions
 * @returns {Promise<http.Server>} Promise of server
 */
async function startWithPort(userOptions: ServerOptions):
    Promise<http.Server> {
      const options = await applyDefaultOptions(userOptions);
      const app = getApp(options);
      const server = await createServer(app, options);
      await new Promise((resolve, reject) => {
        server.listen(options.port, options.hostname, () => {
          handleServerReady(options);
          resolve();
        });

        server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.error(portInUseMessage(options.port));
          }
          reject(err);
        });
      });
      return server;
    }

/**
 * Asserts file existence for all specified files in a push-manifest
 * @param {string} root path to root directory
 * @param {string} manifest manifest object
 */
function assertValidManifest(root: string, manifest: {[path: string]: any}) {

  function assertExists(filename: string) {
    const fname = path.join(root, filename);
    try {
      // Ignore root path, since that always exists for the router
      if (filename !== '/') {
        assert(fs.existsSync(fname), `not found: ${fname}`);
      }
    } catch (err) {
      throw new Error(`invalid h2-push manifest: ${err}`);
    }
  }

  for (const refFile of Object.keys(manifest)) {
    assertExists(refFile);
    for (const pushFile of Object.keys(manifest[refFile])) {
      assertExists(pushFile);
    }
  }
}

/**
 * Reads a push-manifest from the specified path, or a cached version
 * of the file
 * @param {string} root path to root directory
 * @param {string} manifestPath path to manifest file
 * @returns {any} the manifest
 */
function getPushManifest(root: string, manifestPath: string):
    {[path: string]: any} {
      if (!_pushManifest[manifestPath]) {
        const data = fs.readFileSync(manifestPath);
        const manifest = JSON.parse(data.toString());
        assertValidManifest(root, manifest);
        _pushManifest[manifestPath] = manifest;
      }
      return _pushManifest[manifestPath];
    }

/**
 * Pushes any resources for the requested file
 * @param options server options
 * @param req HTTP request
 * @param res HTTP response
 */
function pushResources(options: ServerOptions, req: any, res: any) {
  if (res.push && options.protocol === 'h2' && options.pushManifestPath &&
      !req.get('x-is-push')) {
    // TODO: Handle preload link headers

    const pushManifest =
        getPushManifest(options.root, options.pushManifestPath);
    const resources = pushManifest[req.path];
    if (resources) {
      const root = options.root;
      for (const filename of Object.keys(resources)) {
        const stream: NodeJS.WritableStream =
            res.push(filename, {
                 request: {accept: '*/*'},
                 response: {
                   'content-type': mime.lookup(filename),

                   // Add an X-header to the pushed request so we don't trigger
                   // pushes for pushes
                   'x-is-push': 'true'
                 }
               })
                .on('error',
                    (err: any) =>
                        console.error('failed to push', filename, err));
        fs.createReadStream(path.join(root, filename)).pipe(stream);
      }
    }
  }
}
