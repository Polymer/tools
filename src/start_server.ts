/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as assert from 'assert';
import * as express from 'express';
import * as mime from 'mime';
// TODO: Switch to node-http2 when compatible with express
// https://github.com/molnarg/node-http2/issues/100
import * as http from 'spdy';
import * as pem from 'pem';
import * as path from 'path';
import * as send from 'send';
import * as url from 'url';
import * as fs from 'mz/fs';

import { makeApp } from './make_app';

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

function applyDefaultOptions(options: ServerOptions): ServerOptions {
  const withDefaults = Object.assign({}, options);
  Object.assign(withDefaults, {
    port: options.port || 8080,
    hostname: options.hostname || 'localhost',
    root: path.resolve(options.root || '.'),
    certPath: options.certPath || 'cert.pem',
    keyPath: options.keyPath || 'key.pem',
  });
  return withDefaults;
}

/**
 * @return {Promise} A Promise that completes when the server has started.
 */
export function startServer(options: ServerOptions): Promise<http.Server> {
  return new Promise((resolve) => {
    options = options || {};

    assertNodeVersion(options);

    if (options.port) {
      resolve(options);
    } else {
      findPort(8080, 8180, (ports) => {
        options.port = ports[0];
        resolve(options);
      });
    }
  })
  .then<http.Server>((opts) => startWithPort(opts))
  .catch((e) => {
    console.error('ERROR: Server failed to start:', e);
    return Promise.reject(e);
  });
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
    packageName: options.packageName,
    root,
  });
  options.packageName = polyserve.packageName;

  const filePathRegex: RegExp = /.*\/.+\..{1,}$/;

  app.use('/components/', polyserve);

  app.get('/*', (req, res) => {
    pushResources(options, req, res);
    const filePath = req.path;
    send(req, filePath, {root: root})
      .on('error', (error: send.SendError) => {
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
 * Open the given web page URL. If no browser keyword is provided, `opn` will use
 * the user's default browser.
 */
function openWebPage(url: string, withBrowser?: string) {
  const openOptions = {
    app: withBrowser
  };
  opn(url, openOptions, (err) => {
    if (err) {
      // log error and continue
      console.error(`ERROR: Problem launching "${openOptions.app || 'default web browser'}".`);
    }
  });
}

/**
 * Opens a browser
 * @param options
 * @param serverUrl
 * @param componentUrl
 */
function openBrowser(options: ServerOptions, serverUrl: Object, componentUrl: url.Url) {
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
 * @returns {{serverUrl: {protocol: string, hostname: string, port: string}, componentUrl: url.Url}}
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
    applications: ${url.format(urls.serverUrl)}
    reusable components: ${url.format(urls.componentUrl)}`);
  openBrowser(options, urls.serverUrl, urls.componentUrl);
}

/**
 * Generates a TLS certificate for HTTPS
 * @param {string} keyPath path to TLS service key
 * @param {string} certPath path to TLS certificate
 * @returns {Promise<{}>} Promise of {serviceKey: string, certificate: string}
 */
function createTLSCertificate(keyPath: string, certPath: string) {
  return new Promise<{}>((resolve, reject) => {
    console.log('Generating TLS certificate...');
    pem.createCertificate({days: 1, selfSigned: true}, (err: any, keys: any) => {
      if (err) {
        reject(err);
      } else {
        Promise.all([
              fs.writeFile(certPath, keys.certificate),
              fs.writeFile(keyPath, keys.serviceKey)
            ])
            .then(() => resolve(keys));
      }
    });
  });
}

/**
 * Gets the current TLS certificate (from current directory)
 * or generates one if needed
 * @param {string} keyPath path to TLS service key
 * @param {string} certPath path to TLS certificate
 * @returns {Promise<{}>} Promise of {serviceKey: string, certificate: string}
 */
function getTLSCertificate(keyPath: string, certPath: string) {
  let certificate: string;
  let serviceKey: string;

  const validate = (data: string) => {
    if (!data) {
      throw new Error('invalid data');
    } else {
      return data;
    }
  };

  return Promise.all([
                    fs.readFile(certPath)
                      .then((value: Buffer) => value.toString().trim())
                      .then((data: string) => { certificate = validate(data); }),
                    fs.readFile(keyPath)
                      .then((value: Buffer) => value.toString().trim())
                      .then((data: string) => { serviceKey = validate(data); })
                  ])
                  .then(() => ({
                    certificate: certificate,
                    serviceKey: serviceKey
                  }))
                  .catch(() => createTLSCertificate(keyPath, certPath));
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
      assert(major >= 5, 'h2 requires ALPN which is only supported in node.js >= 5.0');
    }
  }
}

/**
 * Creates an HTTP(S) server
 * @param app
 * @param {ServerOptions} options
 * @returns {Promise<http.Server>} Promise of server
 */
function createServer(app: any, options: ServerOptions): Promise<http.Server> {
  let p: Promise<http.Server>;
  if (isHttps(options.protocol)) {
    p = getTLSCertificate(options.keyPath, options.certPath)
        .then((keys: any) => {
          let opt = {
            spdy: {protocols: [options.protocol]},
            key: keys.serviceKey,
            cert: keys.certificate
          };
          let server = http.createServer(opt, app);
          return Promise.resolve(server);
        });
  } else {
    const spdyOptions = {protocols: [options.protocol], plain: true, ssl: false};
    const server = http.createServer({spdy: spdyOptions}, app);
    p = Promise.resolve(server);
  }
  return p;
}

/**
 * Starts an HTTP(S) server on a specific port
 * @param {ServerOptions} userOptions
 * @returns {Promise<http.Server>} Promise of server
 */
function startWithPort(userOptions: ServerOptions): Promise<http.Server> {
  const options = applyDefaultOptions(userOptions);
  const app = getApp(options);

  return createServer(app, options)
      .then((server) => new Promise<http.Server>((resolve, reject) => {
          server.listen(options.port, options.hostname, () => {
            resolve(server);
            handleServerReady(options);
          });

          server.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
              console.error(portInUseMessage(options.port));
            }
            console.warn('rejecting with err', err);
            reject(err);
          });
        })
      );
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
function getPushManifest(root: string, manifestPath: string): {[path: string]: any} {
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
  if (res.push
      && options.protocol === 'h2'
      && options.pushManifestPath
      && !req.get('x-is-push')) {

    // TODO: Handle preload link headers

    const pushManifest = getPushManifest(options.root, options.pushManifestPath);
    const resources = pushManifest[req.path];
    if (resources) {
      const root = options.root;
      for (const filename of Object.keys(resources)) {
        const stream: NodeJS.WritableStream = res.push(filename,
          {
            request: {
             accept: '*/*'
            },
            response: {
             'content-type': mime.lookup(filename),

             // Add an X-header to the pushed request so we don't trigger pushes for pushes
             'x-is-push': 'true'
            }
          })
          .on('error', (err: any) => console.error('failed to push', filename, err));
        fs.createReadStream(path.join(root, filename)).pipe(stream);
      }
    }
  }
}
