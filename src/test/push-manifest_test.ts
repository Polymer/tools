/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

/// <reference path="../../node_modules/@types/mocha/index.d.ts" />

import {assert} from 'chai';
import * as path from 'path';
import * as vfs from 'vinyl-fs';
import File = require('vinyl');

import {PolymerProject} from '../polymer-project';
import {PushManifest} from '../push-manifest';
import {AsyncTransformStream} from '../streams';

/**
 * A utility stream to check all files that pass through it for a file that
 * matches the given push manifest file path. For that file, the stream asserts
 * that it matches the expected push manifest contents. It will emit
 * "match-success" & "match-failure" events for each test to listen to.
 */
class CheckPushManifest extends AsyncTransformStream<File, File> {
  filePath: string;
  expectedManifest: PushManifest;

  constructor(filePath: string, expectedManifest: PushManifest) {
    super({objectMode: true});
    this.filePath = filePath;
    this.expectedManifest = expectedManifest;
  }

  protected async *
      _transformIter(files: AsyncIterable<File>): AsyncIterable<File> {
    let didAssert = false;
    for await (const file of files) {
      if (this.filePath !== file.path) {
        yield file;
        continue;
      }
      try {
        const pushManifestContents = file.contents.toString();
        const pushManifestJson = JSON.parse(pushManifestContents);
        assert.deepEqual(pushManifestJson, this.expectedManifest);
        this.emit('match-success');
      } catch (err) {
        this.emit('match-failure', err);
      }

      didAssert = true;
      yield file;
    }
    if (!didAssert) {
      throw new Error(`never saw file ${this.filePath}`);
    }
  }
}

/**
 * Utility function to set up the boilerplate for testing the
 * project.addPushManifest() transform stream.
 */
function testPushManifest(
    project: PolymerProject,
    manifestRelativePath: string|undefined,
    prefix: string|undefined,
    expectedManifest: PushManifest,
    done: (err?: Error) => void): void {
  const expectedManifestAbsolutePath = path.join(
      project.config.root, manifestRelativePath || 'push-manifest.json');
  const pushManifestChecker =
      new CheckPushManifest(expectedManifestAbsolutePath, expectedManifest);

  vfs.src(path.join(project.config.root, '**'))
      .on('error', done)
      .pipe(project.addPushManifest(manifestRelativePath, prefix))
      .on('error', done)
      .pipe(pushManifestChecker)
      .on('data', () => {/* noop: needed to start data flow */})
      .on('match-success', done)
      .on('match-failure', done)
      .on('error', done);
}

suite('AddPushManifest', () => {

  const testProjectRoot = path.resolve('test-fixtures/push-manifest-data');

  test('with entrypoint-only config options', (done) => {
    const project = new PolymerProject({
      root: testProjectRoot,
      entrypoint: 'entrypoint-only.html',
    });
    const expectedPushManifest: PushManifest = {
      'entrypoint-only.html': {
        'framework.html': {
          type: 'document',
          weight: 1,
        },
      },
    };

    testPushManifest(project, null, null, expectedPushManifest, done);
  });

  test('with entrypoint and fragments config options', (done) => {
    const project = new PolymerProject({
      root: testProjectRoot,
      entrypoint: 'entrypoint-only.html',
      fragments: ['entrypoint-b.html', 'entrypoint-c.html'],
      sources: [
        'framework.html',
        'shell.html',
        'entrypoint-a.html',
        'entrypoint-b.html',
        'entrypoint-c.html',
        'common-dependency.html',
      ],
    });
    const expectedPushManifest: PushManifest = {
      'entrypoint-only.html': {
        'framework.html': {
          type: 'document',
          weight: 1,
        },
      },
      'common-dependency.html': {
        'example-script.js': {
          'type': 'script',
          'weight': 1,
        },
        'example-style.css': {
          'type': 'style',
          'weight': 1,
        }
      },
      'entrypoint-b.html': {
        'common-dependency.html': {
          type: 'document',
          weight: 1,
        },
        'example-script.js': {
          type: 'script',
          weight: 1,
        },
        'example-style.css': {
          type: 'style',
          weight: 1,
        },
      },
      'entrypoint-c.html': {},
    };

    testPushManifest(project, null, null, expectedPushManifest, done);
  });

  test('with full app-shell config options', (done) => {
    const project = new PolymerProject({
      root: testProjectRoot,
      entrypoint: 'entrypoint-a.html',
      shell: 'shell.html',
      fragments: ['entrypoint-b.html', 'entrypoint-c.html'],
      sources: [
        'framework.html',
        'shell.html',
        'entrypoint-a.html',
        'entrypoint-b.html',
        'entrypoint-c.html',
        'common-dependency.html',
      ],
    });
    const expectedPushManifest: PushManifest = {
      'shell.html': {
        'framework.html': {
          type: 'document',
          weight: 1,
        }
      },
      'common-dependency.html': {
        'example-script.js': {
          'type': 'script',
          'weight': 1,
        },
        'example-style.css': {
          'type': 'style',
          'weight': 1,
        }
      },
      'entrypoint-b.html': {
        'common-dependency.html': {
          type: 'document',
          weight: 1,
        },
        'example-script.js': {
          type: 'script',
          weight: 1,
        },
        'example-style.css': {
          type: 'style',
          weight: 1,
        },
      },
      'entrypoint-c.html': {}
    };

    testPushManifest(project, null, null, expectedPushManifest, done);
  });


  test('with custom file path', (done) => {
    const project = new PolymerProject({
      root: testProjectRoot,
      entrypoint: 'entrypoint-a.html',
      shell: 'shell.html',
      fragments: ['entrypoint-b.html', 'entrypoint-c.html'],
      sources: [
        'framework.html',
        'shell.html',
        'entrypoint-a.html',
        'entrypoint-b.html',
        'entrypoint-c.html',
        'common-dependency.html',
      ],
    });
    const pushManifestRelativePath = 'custom/push-manifest/path.json';
    const expectedPushManifest: PushManifest = {
      'shell.html': {
        'framework.html': {
          type: 'document',
          weight: 1,
        }
      },
      'common-dependency.html': {
        'example-script.js': {
          'type': 'script',
          'weight': 1,
        },
        'example-style.css': {
          'type': 'style',
          'weight': 1,
        }
      },
      'entrypoint-b.html': {
        'common-dependency.html': {
          type: 'document',
          weight: 1,
        },
        'example-script.js': {
          type: 'script',
          weight: 1,
        },
        'example-style.css': {
          type: 'style',
          weight: 1,
        },
      },
      'entrypoint-c.html': {}
    };

    testPushManifest(
        project, pushManifestRelativePath, null, expectedPushManifest, done);
  });

  test('with prefix', (done) => {
    const project = new PolymerProject({
      root: testProjectRoot,
      entrypoint: 'entrypoint-a.html',
      shell: 'shell.html',
      fragments: ['entrypoint-b.html'],
      sources: [
        'framework.html',
        'common-dependency.html',
      ],
    });
    const expectedPushManifest: PushManifest = {
      'foo/shell.html': {
        'foo/framework.html': {
          type: 'document',
          weight: 1,
        }
      },
      'foo/entrypoint-b.html': {
        'foo/common-dependency.html': {
          type: 'document',
          weight: 1,
        },
        'foo/example-script.js': {
          type: 'script',
          weight: 1,
        },
        'foo/example-style.css': {
          type: 'style',
          weight: 1,
        },
      },
    };

    testPushManifest(project, null, '/foo/', expectedPushManifest, done);
  });
});
