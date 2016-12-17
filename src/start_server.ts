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

import * as assert from 'assert';
import * as express from 'express';
import * as fs from 'mz/fs';
import * as path from 'path';
import * as send from 'send';
// TODO: Switch to node-http2 when compatible with express
// https://github.com/molnarg/node-http2/issues/100
import * as http from 'spdy';
import * as url from 'url';

import {bowerConfig} from './bower_config';
import {babelCompile} from './compile-middleware';
import {makeApp} from './make_app';
import {openBrowser} from './util/open_browser';
import {getPushManifest, pushResources} from './util/push';
import {getTLSCertificate} from './util/tls';

const httpProxy = require('http-proxy-middleware');

export interface ServerOptions {
  /** The root directory to serve **/
  root?: string;

  /** Whether or not to compile JavaScript **/
  compile?: 'always'|'never'|'auto';

  /** The port to serve from */
  port?: number;

  /** The hostname to serve from */
  hostname?: string;

  /** Headers to send with every response */
  headers?: {[name: string]: string};

  /** Whether to open the browser when run **/
  open?: boolean;

  /** The browser(s) to open when run with open argument **/
  browser?: string[];

  /** The URL path to open in each browser **/
  openPath?: string;

  /** The component directory to use **/
  componentDir?: string;

  /** The component url to serve **/
  componentUrl?: string;

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

  /** Proxy to redirect for all matching `path` to `target` */
  proxy?: {path: string, target: string};

  /** An optional list of routes & route handlers to attach to the polyserve
   * app, to be handled before all others */
  additionalRoutes?: Map<string, express.RequestHandler>;
}

function applyDefaultServerOptions(options: ServerOptions) {
  const withDefaults: ServerOptions = Object.assign({}, options);
  Object.assign(withDefaults, {
    port: options.port || 0,
    hostname: options.hostname || 'localhost',
    root: path.resolve(options.root || '.'),
    compile: options.compile || 'auto',
    certPath: options.certPath || 'cert.pem',
    keyPath: options.keyPath || 'key.pem',
    // TODO(usergenic): The current behavior of polyserve is to use
    // bower_components for directory and components for url. We should
    // honor the value of `directory` of `.bowerrc` if found in the root dir
    // of the app, to get user-defined defaults.
    componentDir: options.componentDir || 'bower_components',
    componentUrl: options.componentUrl || 'components'
  });
  withDefaults.packageName = options.packageName ||
      bowerConfig(withDefaults.root).name || path.basename(process.cwd());
  return withDefaults;
}

/**
 * @return {Promise} A Promise that completes when the server has started.
 * @deprecated Please use `startServers` instead. This function will be removed
 *     in a future release.
 */
export async function startServer(options: ServerOptions):
    Promise<http.Server> {
  return (await _startServer(options)).server;
}

async function _startServer(options: ServerOptions) {
  options = options || {};
  assertNodeVersion(options);
  try {
    const app = getApp(options);
    const server = await startWithApp(options, app);
    return {app, server};
  } catch (e) {
    console.error('ERROR: Server failed to start:', e);
    throw new Error(e);
  }
}

export type ServerInfo = MainlineServer | VariantServer | ControlServer;

export interface PolyserveServer {
  kind: 'control'|'mainline'|'variant';
  server: http.Server;
  app: express.Application;
  options: ServerOptions;
}

/**
 * The `default` or `primary` server. If only one ServerInfo is returned from
 * startServers it must be a MainlineServer. This is the server that's running
 * with the default configuration and not running a variant configuration.
 */
export interface MainlineServer extends PolyserveServer { kind: 'mainline'; }
/**
 * These are servers which are running some named variant configuration. For
 * multiple variant dependency directories are detected/configured, there will
 * be one MainlineServer that serves out the default dependency directory, and
 * one VariantServer for each other dependency directory.
 */
export interface VariantServer extends PolyserveServer {
  kind: 'variant';
  variantName: string;
  dependencyDir: string;
}
/**
 * If more than one server is started by startServers, the main port will serve
 * out a control server. This server serves out an HTML interface that
 * describes the other servers which have been started, and provides convenience
 * links to them.
 */
export interface ControlServer extends PolyserveServer { kind: 'control'; }

export interface MultipleServersInfo {
  kind: 'MultipleServers';
  mainline: MainlineServer;
  variants: VariantServer[];
  control: ControlServer;
  servers: PolyserveServer[];
}

export type StartServerResult = MainlineServer | MultipleServersInfo;

/**
 * Starts one or more web servers, based on the given options and
 * variant bower_components directories that are found in the root dir.
 */
export async function startServers(options: ServerOptions):
    Promise<StartServerResult> {
  options = applyDefaultServerOptions(options);
  const variants = await findVariants(options);
  // TODO(rictic): support manually configuring variants? tracking more
  //   metadata about them besides their names?
  if (variants.length > 0) {
    return await startVariants(options, variants);
  }

  const serverAndApp = await _startServer(options);
  return {
    options,
    kind: 'mainline',
    server: serverAndApp.server,
    app: serverAndApp.app,
  };
}

// TODO(usergenic): Variants should support the directory naming convention in
// the .bowerrc instead of hardcoded 'bower_components' form seen here.
async function findVariants(options: ServerOptions) {
  const root = options.root || process.cwd();
  const filesInRoot = await fs.readdir(root);
  const variants = filesInRoot
                       .map(f => {
                         const match = f.match(/^bower_components-(.*)/!);
                         return match && {name: match[1], directory: match[0]};
                       })
                       .filter(f => f != null && f.name !== '');
  return variants;
}

async function startVariants(
    options: ServerOptions, variants: {name: string, directory: string}[]) {
  const mainlineOptions = Object.assign({}, options);
  mainlineOptions.port = 0;
  const mainServer = await _startServer(mainlineOptions);
  const mainServerInfo: MainlineServer = {
    kind: 'mainline',
    server: mainServer.server,
    app: mainServer.app,
    options: mainlineOptions,
  };

  const variantServerInfos: VariantServer[] = [];
  for (const variant of variants) {
    const variantOpts = Object.assign({}, options);
    variantOpts.port = 0;
    variantOpts.componentDir = variant.directory;
    const variantServer = await _startServer(variantOpts);
    variantServerInfos.push({
      kind: 'variant',
      variantName: variant.name,
      dependencyDir: variant.directory,
      server: variantServer.server,
      app: variantServer.app,
      options: variantOpts
    });
  };

  const controlServerInfo =
      await startControlServer(options, mainServerInfo, variantServerInfos);
  const servers = ([controlServerInfo, mainServerInfo] as PolyserveServer[])
                      .concat(variantServerInfos);

  const result: MultipleServersInfo = {
    kind: 'MultipleServers',
    control: controlServerInfo,
    mainline: mainServerInfo,
    variants: variantServerInfos, servers,
  };
  return result;
};

export async function startControlServer(
    options: ServerOptions,
    mainlineInfo: MainlineServer,
    variantInfos: VariantServer[]) {
  options = applyDefaultServerOptions(options);
  const app = express();
  app.get('/api/serverInfo', (_req, res) => {
    res.contentType('json');
    res.send(JSON.stringify({
      packageName: options.packageName,
      mainlineServer: {
        port: mainlineInfo.server.address().port,
      },
      variants: variantInfos.map(info => {
        return {name: info.variantName, port: info.server.address().port};
      })
    }));
    res.end();
  });
  const indexPath = path.join(__dirname, '..', 'static', 'index.html');
  app.get('/', async(_req, res) => {
    res.contentType('html');
    const indexContents = await fs.readFile(indexPath, 'utf-8');
    res.send(indexContents);
    res.end();
  });
  const controlServer: ControlServer = {
    kind: 'control',
    options: options,
    server: await startWithApp(options, app), app
  };
  return controlServer;
}

export function getApp(options: ServerOptions): express.Express {
  options = applyDefaultServerOptions(options);

  // Preload the h2-push manifest to avoid the cost on first push
  if (options.pushManifestPath) {
    getPushManifest(options.root, options.pushManifestPath);
  }

  const root = options.root || '.';
  const app = express();

  if (options.additionalRoutes) {
    options.additionalRoutes.forEach((handler, route) => {
      app.get(route, handler);
    });
  }

  const componentUrl = options.componentUrl;

  const polyserve = makeApp({
    componentDir: options.componentDir,
    packageName: options.packageName,
    root: root,
    headers: options.headers,
  });
  options.packageName = polyserve.packageName;

  const filePathRegex: RegExp = /.*\/.+\..{1,}$/;

  if (options.proxy) {
    if (options.proxy.path.startsWith(componentUrl)) {
      console.error(`proxy path can not start with ${componentUrl}.`);
      return;
    }

    let escapedPath = options.proxy.path;

    for (let char of ['*', '?', '+']) {
      if (escapedPath.indexOf(char) > -1) {
        console.warn(
            `Proxy path includes character "${char}" which can cause problems during route matching.`);
      }
    }

    if (escapedPath.startsWith('/')) {
      escapedPath = escapedPath.substring(1);
    }
    if (escapedPath.endsWith('/')) {
      escapedPath = escapedPath.slice(0, -1);
    }
    const pathRewrite = {};
    pathRewrite[`^/${escapedPath}`] = '';
    const apiProxy = httpProxy(`/${escapedPath}`, {
      target: options.proxy.target,
      changeOrigin: true,
      pathRewrite: pathRewrite
    });
    app.use(`/${escapedPath}/`, apiProxy);
  }

  if (options.compile === 'auto' || options.compile === 'always') {
    app.use('*', babelCompile(options.compile === 'always'));
  }

  app.use(`/${componentUrl}/`, polyserve);

  app.get('/*', (req, res) => {
    pushResources(options, req, res);
    const filePath = req.path;
    send(req, filePath, {root: root})
        .on('error',
            (error: send.SendError) => {
              if ((error).status === 404 && !filePathRegex.test(filePath)) {
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
export function getServerUrls(options: ServerOptions, server: http.Server) {
  options = applyDefaultServerOptions(options);
  const address = server.address();
  const serverUrl: url.Url = {
    protocol: isHttps(options.protocol) ? 'https' : 'http',
    hostname: address.address,
    port: String(address.port),
  };
  const componentUrl: url.Url = Object.assign({}, serverUrl);
  componentUrl.pathname = `${options.componentUrl}/${options.packageName}/`;
  return {serverUrl, componentUrl};
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
async function createServer(app: express.Application, options: ServerOptions):
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

      return http.createServer(opt, app as any);
    }

// Sauce Labs compatible ports taken from
// https://wiki.saucelabs.com/display/DOCS/Sauce+Connect+Proxy+FAQS#SauceConnectProxyFAQS-CanIAccessApplicationsonlocalhost?
// - 80, 443, 888: these ports must have root access
// - 5555, 8080: not forwarded on Android
const SAUCE_PORTS = [
  8081, 8000, 8001, 8003, 8031,  // webbier-looking ports first
  2000, 2001, 2020, 2109, 2222, 2310, 3000, 3001, 3030,  3210, 3333,
  4000, 4001, 4040, 4321, 4502, 4503, 4567, 5000, 5001,  5050, 5432,
  6000, 6001, 6060, 6666, 6543, 7000, 7070, 7774, 7777,  8765, 8777,
  8888, 9000, 9001, 9080, 9090, 9876, 9877, 9999, 49221, 55001
];

/**
 * Starts an HTTP(S) server serving the given app.
 */
export async function startWithApp(
    options: ServerOptions, app: express.Application): Promise<http.Server> {
  options = applyDefaultServerOptions(options);
  const ports = options.port ? [options.port] : SAUCE_PORTS;
  const server = await startWithFirstAvailablePort(options, app, ports);
  const urls = getServerUrls(options, server);
  openBrowser(options, urls.serverUrl, urls.componentUrl);

  return server;
}

async function startWithFirstAvailablePort(
    options: ServerOptions, app: express.Application, ports: number[]):
    Promise<http.Server> {
      for (const port of ports) {
        const server = await tryStartWithPort(options, app, port);
        if (server) {
          return server;
        }
      }
      throw new Error(
          `No available ports. Ports tried: ${JSON.stringify(ports)}`);
    }

async function tryStartWithPort(
    options: ServerOptions, app: express.Application, port: number) {
  const server = await createServer(app, options);
  return new Promise<http.Server|null>((resolve, _reject) => {
    server.listen(port, options.hostname, () => {
      resolve(server);
    });

    server.on('error', (_err: any) => {
      resolve(null);
    });
  });
}
