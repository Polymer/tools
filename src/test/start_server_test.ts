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
import * as supertest from 'supertest';
import * as tmp from 'tmp';

import {getApp, ServerOptions} from '../start_server';
import {startServer} from '../start_server';


chai.use(chaiAsPromised);
const assert = chai.assert;

const root = path.join(__dirname, '..', '..', 'test');

suite('startServer', () => {

  test('returns an app', () => {
    let app = getApp({});
    assert.isOk(app);
  });

  test('serves root application files', (done) => {
    let app = getApp({root});
    supertest(app).get('/test-file.txt').expect(200, 'PASS\n').end(done);
  });

  test('serves component files', (done) => {
    let app = getApp({root});
    supertest(app)
        .get('/bower_components/test-component/test-file.txt')
        .expect(200, 'TEST COMPONENT\n')
        .end(done);
  });

  test('serves index.html, not 404', (done) => {
    let app = getApp({root});
    supertest(app).get('/foo').expect(200, 'INDEX\n').end(done);
  });

  ['html', 'js', 'json', 'css', 'png', 'jpg', 'jpeg', 'gif'].forEach(
      (ext) => {test(`404s ${ext} files`, (done) => {
        let app = getApp({root});

        supertest(app).get('/foo.' + ext).expect(404).end(done);
      })});

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

      test('generates new TLS cert/key if unspecified', (done) => {
        const createCertSpy = sinon.spy(pem, 'createCertificate');

        // reset paths to key/cert files so that default paths are used
        _serverOptions.keyPath = undefined;
        _serverOptions.certPath = undefined;

        const certFilePath = 'cert.pem';
        const keyFilePath = 'key.pem';
        _deleteFiles([certFilePath, keyFilePath]);

        let server: http.server.Server;
        let error: any;
        _startStubServer(_serverOptions)
            .then(s => {
              assert.isOk(s);
              server = s;
            })
            .then(() => sinon.assert.calledOnce(createCertSpy))
            .then(() => Promise.all([
              fs.readFile(certFilePath)
                  .then(buf => _assertValidCert(buf.toString())),
              fs.readFile(keyFilePath)
                  .then(buf => _assertValidKey(buf.toString()))
            ]))
            .catch(e => error = e)
            .then(() => _deleteFiles([certFilePath, keyFilePath]))
            .then(() => {
              createCertSpy.restore();
              server.close(() => done(error));
            });
      });

      test('generates new TLS cert/key if specified files blank', (done) => {
        const createCertSpy = sinon.spy(pem, 'createCertificate');

        let server: http.server.Server;
        let error: any;
        _startStubServer(_serverOptions)
            .then(s => {
              assert.isOk(s);
              server = s;
            })
            .then(() => sinon.assert.calledOnce(createCertSpy))
            .then(() => Promise.all([
              // _certFile and _keyFile point to newly created (blank) temp
              // files
              fs.readFile(_certFile.name)
                  .then(buf => _assertValidCert(buf.toString())),
              fs.readFile(_keyFile.name)
                  .then(buf => _assertValidKey(buf.toString()))
            ]))
            .catch(e => error = e)
            .then(() => {
              createCertSpy.restore();
              server.close(() => done(error));
            });
      });

      test('reuses TLS cert/key', (done) => {
        _serverOptions.keyPath = path.join(root, 'key.pem');
        _serverOptions.certPath = path.join(root, 'cert.pem');

        const createCertSpy = sinon.spy(pem, 'createCertificate');

        let server: http.server.Server;
        let error: any;
        _startStubServer(_serverOptions)
            .then(s => {
              assert.isOk(s);
              server = s;
            })
            .then(() => {
              sinon.assert.notCalled(createCertSpy);
            })
            .catch(e => error = e)
            .then(() => {
              createCertSpy.restore();
              server.close(() => done(error));
            });
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

    function _deleteFiles(files: Iterable<string>) {
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
