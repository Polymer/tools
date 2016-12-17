/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'mz/fs';
import * as path from 'path';
import * as pem from 'pem';
import * as sinon from 'sinon';
import * as http from 'spdy';
import * as supertest from 'supertest-as-promised';
import * as tmp from 'tmp';

import {getApp, ServerOptions} from '../start_server';
import {startServer, startServers} from '../start_server';


chai.use(chaiAsPromised);
const assert = chai.assert;

const root = path.join(__dirname, '..', '..', 'test');

suite('startServer', () => {

  test('returns an app', () => {
    const app = getApp({});
    assert.isOk(app);
  });

  test('serves root application files', async() => {
    const app = getApp({root});
    await supertest(app).get('/test-file.txt').expect(200, 'PASS\n');
  });

  test('serves root application files if root isn\'t set', async() => {
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const app = getApp({});
      await supertest(app).get('/test-file.txt').expect(200, 'PASS\n');
    } finally {
      process.chdir(cwd);
    }
  });

  test('serves component files', async() => {
    const app = getApp({root});
    await supertest(app)
        .get('/bower_components/test-component/test-file.txt')
        .expect(200, 'TEST COMPONENT\n');
  });


  test('serves index.html, not 404', async() => {
    const app = getApp({root});
    await supertest(app).get('/foo').expect(200).expect((res: any) => {
      if (!res.text.includes('INDEX')) {
        throw new Error('Expected body to contain INDEX');
      }
    });
  });

  ['html', 'js', 'json', 'css', 'png', 'jpg', 'jpeg', 'gif'].forEach((ext) => {
    test(`404s ${ext} files`, async() => {
      const app = getApp({root});

      await supertest(app).get('/foo.' + ext).expect(404);
    });
  });

  suite('compilation', () => {

    const testCompilation = (options: {
      url: string,
      agent?: string,
      compile: 'always' | 'never' | 'auto',
      result: 'compiled' | 'uncompiled'
    }) => async() => {
      const url = options.url;
      const agent = options.agent;
      const compile = options.compile;
      const result = options.result;
      const app = getApp({
        root: root,
        componentDir: path.join(root, 'bower_components'),
        compile: compile,
      });
      let request = supertest(app).get(url);
      if (agent) {
        request = request.set('User-Agent', agent);
      }
      const response = await request;
      const isCompiled = response.text.indexOf('class A {}') === -1;
      const shouldCompile = result === 'compiled';
      if (isCompiled && !shouldCompile) {
        throw new Error('Source was compiled');
      } else if (!isCompiled && shouldCompile) {
        throw new Error('Source was not compiled');
      }
    };

    test(
        'compiles external component JS when --compile=always',
        testCompilation({
          url: '/components/test-component/test.js',
          compile: 'always',
          result: 'compiled',
        }));

    test('compiles external app JS when --compile=always', testCompilation({
           url: '/test.js',
           compile: 'always',
           result: 'compiled',
         }));

    test('compiles inline component JS when --compile=always', testCompilation({
           url: '/components/test-component/test.html',
           compile: 'always',
           result: 'compiled',
         }));

    test('compiles inline app JS when --compile=always', testCompilation({
           url: '/test.html',
           compile: 'always',
           result: 'compiled',
         }));

    test('doesn\'t compile external JS when --compile=never', testCompilation({
           url: '/components/test-component/test.js',
           compile: 'never',
           result: 'uncompiled',
         }));

    test('doesn\'t compile inline JS when --compile=never', testCompilation({
           url: '/components/test-component/test.html',
           compile: 'never',
           result: 'uncompiled',
         }));

    test(
        'doesn\'t compile external JS when --compile=auto and agent is Chrome',
        testCompilation({
          url: '/components/test-component/test.js',
          agent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.52 Safari/537.36',
          compile: 'auto',
          result: 'uncompiled',
        }));

    test(
        'compiles external JS when --compile=auto and agent is unknown',
        testCompilation({
          url: '/components/test-component/test.js',
          compile: 'auto',
          result: 'compiled',
        }));
  });

  suite('proxy', () => {
    let consoleError: (message?: any) => void;
    let consoleWarn: (message?: any) => void;
    let proxyServer: http.Server;
    let app: http.Server;
    async function setUpProxy(path: string) {
      app = await startServer({root});

      return proxyServer = await startServer({
               port: 0,
               root: __dirname,
               proxy: {
                 path: path,
                 target: `http://localhost:${app.address().port}/`
               }
             });
    }

    setup(() => {
      consoleError = console.error;
      consoleWarn = console.warn;
    });

    teardown(async() => {
      console.error = consoleError;
      console.warn = consoleWarn;
      await Promise.all([
        proxyServer && new Promise((resolve, _) => proxyServer.close(resolve)),
        new Promise((resolve, _) => app.close(resolve)),
      ]);
    });

    test('rewrites directory with proxy', async() => {
      await setUpProxy('normally-non-existing-path');
      await supertest(proxyServer)
          .get(
              '/normally-non-existing-path/bower_components/test-component/test-file.txt')
          .expect(200, 'TEST COMPONENT\n');
    });

    test('warns when path contains special regex characters', async() => {
      const spy = sinon.spy();
      console.warn = spy;
      app = await startServer(
          {root: __dirname, proxy: {path: '+regex?path*', target: 'target'}});
      assert.equal(spy.callCount, 3);
    });

    test('handles additional slashes at start or end of path', async() => {
      await setUpProxy('/api/v1/');
      await supertest(proxyServer)
          .get('/api/v1/bower_components/test-component/test-file.txt')
          .expect(200, 'TEST COMPONENT\n');
    });

    test('does not set up proxy that starts with components', async() => {
      const spy = sinon.spy();
      console.error = spy;
      app = await startServer(
          {root: __dirname, proxy: {path: 'components', target: 'target'}});
      assert.isTrue(spy.calledOnce);
    });

    test('redirects to root of proxy', async() => {
      await setUpProxy('api/v1');
      await supertest(proxyServer)
          .get('/api/v1/')
          .expect(200)
          .expect((res: any) => {
            if (!res.text.includes('INDEX')) {
              throw new Error('Expected body to contain INDEX');
            }
          });
    });
  });

  suite('h2', () => {
    let _certFile: tmp.SynchrounousResult;
    let _keyFile: tmp.SynchrounousResult;
    let _nodeVersion: number;
    let _serverOptions: ServerOptions;
    let _stubServer: http.server.Server;

    _setupNodeVersion();

    suiteSetup(() => {
      _setupServerOptions();
      _setupStubServer();
    });

    suiteTeardown(() => {
      _teardownStubServer();
    });

    test('rejects unsupported Node version (< 5) only', function() {
      if (_nodeVersion < 5) {
        return assert.isRejected(startServer(_serverOptions));
      } else {
        return assert.becomes(_startStubServer(_serverOptions), _stubServer);
      }
    });

    // Only run h2 tests for Node versions that support ALPN
    const suiteDef = (_nodeVersion < 5) ? suite.skip : suite;
    suiteDef('node5+', () => {
      setup(() => {
        _setupServerOptions();
      });

      test('generates new TLS cert/key if unspecified', async() => {
        const createCertSpy = sinon.spy(pem, 'createCertificate');

        // reset paths to key/cert files so that default paths are used
        _serverOptions.keyPath = undefined;
        _serverOptions.certPath = undefined;

        const certFilePath = 'cert.pem';
        const keyFilePath = 'key.pem';
        _deleteFiles([certFilePath, keyFilePath]);

        try {
          const server = await _startStubServer(_serverOptions);
          assert.isOk(server);
          await sinon.assert.calledOnce(createCertSpy);
          await Promise.all([
            fs.readFile(certFilePath)
                .then(buf => _assertValidCert(buf.toString())),
            fs.readFile(keyFilePath)
                .then(buf => _assertValidKey(buf.toString()))
          ]);
          await _deleteFiles([certFilePath, keyFilePath]);
          await new Promise((resolve) => server.close(resolve));
        } finally {
          createCertSpy.restore();
        }
      });

      test('generates new TLS cert/key if specified files blank', async() => {
        const createCertSpy = sinon.spy(pem, 'createCertificate');

        try {
          const server = await _startStubServer(_serverOptions);
          assert.isOk(server);
          await sinon.assert.calledOnce(createCertSpy);
          await Promise.all([
            // _certFile and _keyFile point to newly created (blank) temp
            // files
            fs.readFile(_certFile.name)
                .then(buf => _assertValidCert(buf.toString())),
            fs.readFile(_keyFile.name)
                .then(buf => _assertValidKey(buf.toString()))
          ]);
          await new Promise((resolve) => server.close(resolve));
        } finally {
          createCertSpy.restore();
        }
      });

      test('reuses TLS cert/key', async() => {
        _serverOptions.keyPath = path.join(root, 'key.pem');
        _serverOptions.certPath = path.join(root, 'cert.pem');

        const createCertSpy = sinon.spy(pem, 'createCertificate');


        try {
          const server = await _startStubServer(_serverOptions);
          assert.isOk(server);
          await sinon.assert.notCalled(createCertSpy);
          await new Promise((resolve) => server.close(resolve));
        } finally {
          createCertSpy.restore();
        }
      });

      test('throws error for blank h2-push manifest', () => {
        const dummyFile = tmp.fileSync();
        _serverOptions.pushManifestPath = dummyFile.name;
        assert.throws(() => getApp(_serverOptions));
      });

      test.skip(
          'pushes only files specified in manifest',
          () => {
              // TODO: Implement
          });

      test.skip(
          'pushes only files specified in link-preload header',
          () => {
              // TODO: Implement
          });

      test.skip(
          'does not push files specified as nopush in link-preload header',
          () => {
              // TODO: Implement
          });

      test.skip(
          'rejects nonexistent file in manifest',
          () => {
              // TODO: Implement
          });

      test.skip(
          'accepts root path in manifest',
          () => {
              // TODO: Implement
          });
    });

    function _setupServerOptions() {
      _keyFile = tmp.fileSync();
      _certFile = tmp.fileSync();
      _serverOptions = {
        root,
        protocol: 'h2',
        keyPath: _keyFile.name,
        certPath: _certFile.name
      };
    }

    function _setupNodeVersion() {
      const matches = /(\d+)\./.exec(process.version);
      if (matches) {
        _nodeVersion = Number(matches[1]);
      }
    }

    let createServerStub: sinon.SinonStub;
    function _setupStubServer() {
      _stubServer =
          sinon.createStubInstance(http['Server']) as any as http.Server;
      createServerStub = sinon.stub(http, 'createServer').returns(_stubServer);
      _stubServer.close = (cb) => cb.call(_stubServer);
    }

    function _teardownStubServer() {
      createServerStub.restore();
    }

    async function _startStubServer(options: ServerOptions) {
      return new Promise<http.server.Server>(resolve => {
        _stubServer.listen = (() => resolve(_stubServer)) as any;
        startServer(options);
      });
    }

    function _assertValidCert(cert: string) {
      return new Promise((resolve, reject) => {
        if (!cert) {
          reject(new Error('invalid cert'));
        } else {
          pem.readCertificateInfo(cert, (err: any) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    }

    function _assertValidKey(key: string) {
      return new Promise((resolve, reject) => {
        if (/BEGIN[^]+?KEY[^]+END[^]+?KEY/.test(key)) {
          resolve();
        } else {
          reject(new Error('invalid key'));
        }
      });
    }

    function _deleteFiles(files: string[]) {
      for (const file of files) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          // ignore
        }
      }
    }
  });
});

suite('startServers', () => {
  suite('variants', () => {
    const variantsRoot = path.join(root, 'variants');

    let prevCwd: string;
    setup(() => {
      prevCwd = process.cwd();
      process.chdir(variantsRoot);
    });

    teardown(() => {
      process.chdir(prevCwd);
    });

    test('serves files out of a given components directory', async() => {
      const servers = await startServers({});

      if (servers.kind !== 'MultipleServers') {
        throw new Error('Expected startServers to start multiple servers');
      }

      const mainlineServer = servers.mainline;
      await supertest(mainlineServer.server)
          .get('/components/contents.txt')
          .expect(200, 'mainline\n');

      const fooServer = servers.variants.find(s => s.variantName === 'foo');
      await supertest(fooServer.server)
          .get('/components/contents.txt')
          .expect(200, 'foo\n');

      const barServer = servers.variants.find(s => s.variantName === 'bar');
      await supertest(barServer.server)
          .get('/components/contents.txt')
          .expect(200, 'bar\n');

      const dispatchServer = servers.control;
      const dispatchTester = supertest(dispatchServer.server);
      const apiResponse =
          await dispatchTester.get('/api/serverInfo').expect(200);
      assert.deepEqual(JSON.parse(apiResponse.text), {
        packageName: 'variants-test',
        mainlineServer: {port: mainlineServer.server.address().port},
        variants: [
          {name: 'bar', port: barServer.server.address().port},
          {name: 'foo', port: fooServer.server.address().port}
        ]
      });
      const pageResponse = await dispatchTester.get('/').expect(200);
      // Assert that some polyserve html is served.
      assert.match(pageResponse.text, /<html>/);
      assert.match(pageResponse.text, /Polyserve/);
    });
  });
});
