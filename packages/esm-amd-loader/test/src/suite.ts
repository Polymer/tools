/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

// Test data is laid out as follows:
//
// .
// ├── x.js (module with no dependencies)
// └── y
//     ├── suite.html (base HTML document)
//     ├── suite.min.html (same as suite.html but uses minified version)
//     ├── y.js (module with no dependencies)
//     ├── no-define.js (module which does not call define)
//     └── z
//         ├── z.js (module which depends on x.js)
//         └── exports-meta.js (module which exports its own meta)
//
// All of the test module scripts will throw if they are executed more than
// once.

/// <reference path="../node_modules/@polymer/esm-amd-loader/lib/esm-amd-loader.d.ts" />

/* tslint:disable no-any exports are untyped */

const {assert} = chai;
const define = window.define;

interface Window {
  /**
   * A function to filter out expected uncaught errors.
   *
   * If this function exists, then any events fired from the window's 'error'
   * will be passed to this function. If it returns true, then the error event
   * will not be logged and will not cause tests to fail.
   *
   * (typing copied from WCT. should try to import it).
   */
  uncaughtErrorFilter?(errorEvent: ErrorEvent): boolean;
}

interface Window {
  executed: {[url: string]: true};
  checkExecuted: (key: string) => void;
  executionOrder: string[];
  addExecutedForImport?: (key: string) => void;
  testImportMeta?: (url: string) => void;
}

window.checkExecuted = (key) => {
  if (window.executed[key] === true) {
    throw new Error('already executed: ' + key);
  }
  window.executed[key] = true;
};

setup(() => {
  define._reset!();
  window.executed = {};
  window.executionOrder = [];
  window.addExecutedForImport = undefined;
  window.testImportMeta = undefined;
});

test('define an empty module', (done) => {
  define([], () => done());
});

suite('static dependencies', () => {
  test('load 1 dependency', (done) => {
    define(['./y.js'], (y: any) => {
      assert.equal(y.y, 'y');
      done();
    });
  });

  test('load 2 dependencies', (done) => {
    define(['../x.js', './y.js'], (x: any, y: any) => {
      assert.equal(x.x, 'x');
      assert.equal(y.y, 'y');
      done();
    });
  });

  test('loads absolute path url', (done) => {
    define(
        ['/components/@polymer/esm-amd-loader-test/static/y/y.js'],
        (y: any) => {
          assert.equal(y.y, 'y');
          done();
        });
  });

  suite('with base tag', () => {
    let base: HTMLBaseElement;

    suiteSetup(() => {
      base = document.createElement('base');
      base.href = '/components/@polymer/esm-amd-loader-test/';
      document.head.appendChild(base);
    });

    suiteTeardown(() => {
      document.head.removeChild(base);
    });

    test('loads relative path url', (done) => {
      define(['./static/y/y.js'], (y: any) => {
        assert.equal(y.y, 'y');
        done();
      });
    });

    test('loads absolute path url', (done) => {
      define(
          ['/components/@polymer/esm-amd-loader-test/static/y/y.js'],
          (y: any) => {
            assert.equal(y.y, 'y');
            done();
          });
    });
  });

  suite('failure', () => {
    teardown(() => {
      window.uncaughtErrorFilter = undefined;
    });

    test('do not execute a module when a static dependency 404s', (done) => {
      window.uncaughtErrorFilter = (e) => {
        // The test is done next tick.
        setTimeout(done);
        // We only expect this error once.
        window.uncaughtErrorFilter = undefined;
        // Only filter a failure to fetch a file that does not exist.
        return /Failed to fetch .*static\/y\/not-found\.js/.test(
            e.error.message);
      };

      define(['./not-found.js'], () => assert.fail());
    });

    const testName =
        'modules before a failure execute, but after a failure do not';
    test(testName, (done) => {
      define(['require'], (require: any) => {
        require(
            [
              '../failure/beforeFailure.js',
              '../failure/failure.js',
              '../failure/afterFailure.js'
            ],
            () => {
              window.executionOrder.push('toplevel');
              assert.fail('should have been stopped by failure.js');
            },
            (error: Error) => {
              assert.deepEqual(
                  window.executionOrder, ['beforeFailure', 'failure']);
              assert.include(error.message, 'failure.js is supposed to fail');
              done();
            });
      });
    });
  });

  test('dedupe dependencies', (done) => {
    // All these relative paths refer to the same module, so we should expect it
    // runs only once, and we get the same exports object every time.
    const paths = [
      './y.js',
      './y.js',
      'y.js',
      '../y/y.js',
      'z/../y.js',
    ];
    const exports: any[] = [];
    let pending = 0;

    for (let i = 0; i < paths.length; i++) {
      pending++;
      define([paths[i]], (a: any) => {
        exports.push(a);
        check();
      });
    }

    function check() {
      if (--pending > 0) {
        return;
      }
      assert.lengthOf(exports, paths.length);
      exports.forEach((y) => assert.equal(y, exports[0]));
      done();
    }
  });

  test('dedupe transitive dependencies', (done) => {
    define(['../x.js', './z/z.js'], (x: any, z: any) => {
      assert.equal(x.x, 'x');
      assert.equal(z.zx, 'zx');
      done();
    });
  });

  test('module with no define call exports the empty object', (done) => {
    define(['./no-define.js'], (noDefine: any) => {
      assert.deepEqual(noDefine, {});
      done();
    });
  });
});

suite('top-level modules', () => {
  test('execute in the order they are defined', (done) => {
    const order: number[] = [];
    let pending = 0;

    pending++;
    define(['../x.js', './y.js'], () => {
      order.push(0);
      check();
    });

    // This define call has no dependencies, so it would execute before the
    // one above unless we were explicitly ordering top-level scripts.
    pending++;
    define([], () => {
      order.push(1);
      check();
    });

    pending++;
    define(['./y.js'], () => {
      order.push(2);
      check();
    });

    function check() {
      if (--pending > 0) {
        return;
      }
      assert.deepEqual(order, [0, 1, 2]);
      done();
    }
  });

  suite('failing modules', () => {
    teardown(() => {
      window.uncaughtErrorFilter = undefined;
    });

    test('can fail without blocking the next one', (done) => {
      window.uncaughtErrorFilter = (e) => {
        // We only expect this error once.
        window.uncaughtErrorFilter = undefined;
        // Look for a failure to fetch the file that does not exist.
        return /Failed to fetch .*static\/y\/not-found\.js/.test(
            e.error.message);
      };
      // We order top-level modules sequentially.
      // However, unlike normal dependencies, if module 1 fails, we should still
      // execute module 2.
      define(['./not-found.js'], () => assert.fail());
      define([], () => done());
    });
  });
});

suite('dynamic require', () => {
  test('load 1 dependency', (done) => {
    define(['require'], (require: any) => {
      require(['./y.js'], function(y: any) {
        assert.equal(y.y, 'y');
        done();
      });
    });
  });

  test('load 2 dependencies', (done) => {
    define(['require'], (require: any) => {
      require(['../x.js', './y.js'], function(x: any, y: any) {
        assert.equal(x.x, 'x');
        assert.equal(y.y, 'y');
        done();
      });
    });
  });

  test('calls error callback on 404', (done) => {
    define(['require'], (require: any) => {
      require(['./not-found.js'], () => assert.fail(), (error: Error) => {
        assert.instanceOf(error, TypeError);
        assert.include(error.message, 'not-found.js');
        done();
      });
    });
  });

  test('calls error callback only once on multiple 404s', (done) => {
    let num404s = 0;
    let numCallbackCalls = 0;

    window.addEventListener('error', on404, true);

    function on404() {
      num404s++;
      if (num404s === 2) {
        window.removeEventListener('error', on404);
        // Need a tick to ensure the loader error handlers have fired.
        setTimeout(() => {
          assert.equal(numCallbackCalls, 1);
          done();
        });
      }
    }

    define(['require'], (require: any) => {
      require(
          ['./not-found-a.js', './not-found-b.js'],
          () => assert.fail(),
          () => numCallbackCalls++);
    });
  });
});

suite('meta.url', () => {
  test('top-level HTML document', (done) => {
    define(['meta'], (meta: any) => {
      assert.match(meta.url, /https?:\/\/.+\/static\/y\/suite(\-min)?\.html/);
      done();
    });
  });

  test('module at deeper path', (done) => {
    define(['./z/exports-meta.js'], (exportsMeta: any) => {
      assert.match(
          exportsMeta.meta.url,
          /https?:\/\/.+\/static\/y\/z\/exports-meta\.js/);
      done();
    });
  });

  suite('with base tag', () => {
    let base: HTMLBaseElement;

    suiteSetup(() => {
      base = document.createElement('base');
      // Note that fragments are included in import.meta.url.
      base.href = 'http://example.com/?foo#bar';
      document.head.appendChild(base);
    });

    suiteTeardown(() => {
      document.head.removeChild(base);
    });

    test('top-level HTML document', (done) => {
      define(['meta'], (meta: any) => {
        assert.equal(meta.url, 'http://example.com/?foo#bar');
        done();
      });
    });
  });
});

// Test for https://github.com/Polymer/tools/issues/335
suite('dependency ordering', () => {
  test('all else being equal, dependencies execute in import order', (done) => {
    define(['../race/start.js'], () => {
      assert.deepEqual(window.executionOrder, ['baz', 'foo', 'bar', 'start']);
      done();
    });
  });

  // The dependency graph here looks like:
  // suite.html#0  -> start-one
  // suite.html#1  -> start-two
  // start-one -> [a, e]
  // start-two -> [a, g, h]
  // a -> [b, e]
  // b -> [c, d]
  // e -> [f, g]
  // h -> [i, j, k]
  const testName =
      'order modules according to their position in the global total ordering, not just based on file-local information';
  test(testName, (done) => {
    define(['../deepRace/start-one.js'], () => {
      window.executionOrder.push('suite#0');
    });
    define(['../deepRace/start-two.js'], () => {
      window.executionOrder.push('suite#1');
      assert.deepEqual(window.executionOrder, [
        'c',
        'd',
        'b',
        'f',
        'g',
        'e',
        'a',
        'start-one',
        'suite#0',
        'i',
        'j',
        'k',
        'h',
        'start-two',
        'suite#1'
      ]);
      done();
    });
  });
});

suite('cyclical dependencies', () => {
  test('get a first', (done) => {
    define(['../cycle/a.js', '../cycle/b.js'], (a: any, b: any) => {
      assert.deepEqual(a.a, 'a');
      assert.deepEqual(b.b, 'b');
      assert.deepEqual(a.getterForB(), 'b');
      assert.deepEqual(b.getterForA(), 'a');
      assert.deepEqual(a.usesBAtExecution, 'b');
      assert.deepEqual(b.usesAAtExecution, undefined);
      done();
    });
  });

  test('get b first', (done) => {
    define(['../cycle/b.js', '../cycle/a.js'], (b: any, a: any) => {
      assert.deepEqual(a.a, 'a');
      assert.deepEqual(b.b, 'b');
      assert.deepEqual(a.getterForB(), 'b');
      assert.deepEqual(b.getterForA(), 'a');
      assert.deepEqual(a.usesBAtExecution, undefined);
      assert.deepEqual(b.usesAAtExecution, 'a');
      done();
    });
  });
});

suite('html imports', () => {
  function importHref(href: string) {
    const link = document.createElement('link');
    link.rel = 'import';
    link.href = href;
    document.head.appendChild(link);
  }

  function testImport(href: string, expectedOrder: string[], done: () => void) {
    // Each time an amd module in the chain is executed, it registers itself.
    // If we've reached the length of modules we are expecing to be loaded,
    // we check if the right modules were loaded in the expected order
    window.addExecutedForImport = (name: string) => {
      window.executionOrder.push(name);
      if (window.executionOrder.length === expectedOrder.length) {
        assert.deepEqual(window.executionOrder, expectedOrder);
        done();
      }
    };

    importHref(href);
  }

  test('modules in root level html import', (done) => {
    testImport('root-html-import.html', ['x', 'root-html-import'], done);
  });

  test('modules inside deeper level html import', (done) => {
    testImport(
        '../html-import/y/deep-import.html',
        ['x', 'z', 'y', 'deep-import'],
        done);
  });

  test('imports with child imports', (done) => {
    testImport(
        '../html-import/parent-import.html',
        ['z', 'y', 'child-import', 'x', 'parent-import'],
        done);
  });

  test('import with meta', (done) => {
    window.testImportMeta = (url) => {
      assert.match(url, /https?:\/\/.+\/html-import\/meta\/import-meta.html/);
      done();
    };
    importHref('../html-import/meta/import-meta.html');
  });
});
