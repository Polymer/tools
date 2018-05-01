/* tslint:disable no-any exports are untyped */

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

const {assert} = chai;
const define = window.define;

interface Window {
  executed: {[url: string]: true};
  checkExecuted: (key: string) => void;
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
  }).timeout(30);

  test('load 2 dependencies', (done) => {
    define(['../x.js', './y.js'], (x: any, y: any) => {
      assert.equal(x.x, 'x');
      assert.equal(y.y, 'y');
      done();
    });
  });

  test('do not resolve when a static dependency 404s', (done) => {
    define(['./not-found.js'], () => assert.fail());
    setTimeout(done, 30);
  });

  test('dedupe dependencies', async () => {
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
    const promises = [];

    for (const path of paths) {
      promises.push(new Promise((resolve) => {
        define([path], (a: any) => {
          exports.push(a);
          resolve();
        });
      }));
    }

    await Promise.all(promises);
    assert.lengthOf(exports, paths.length);
    exports.forEach((y) => assert.equal(y, exports[0]));
  });

  test('dedupe transitive dependencies', (done) => {
    define(['../x.js', './z/z.js'], (x: any, z: any) => {
      assert.equal(x.x, 'x');
      assert.equal(z.zx, 'zx');
      done();
    });
  });

  test('module with no define call resolves to empty exports', (done) => {
    define(['./no-define.js'], (noDefine: any) => {
      assert.deepEqual(noDefine, {});
      done();
    });
  });
});

suite('top-level modules', () => {
  test('execute in the order they are defined', async () => {
    const promises = [];
    const order: number[] = [];

    promises.push(new Promise((resolve) => {
      define(['../x.js', './y.js'], () => {
        order.push(0);
        resolve();
      });
    }));

    // This define call has no dependencies, so it would resolve before the one
    // above unless we were explicitly ordering top-level scripts.
    promises.push(new Promise((resolve) => {
      define([], () => {
        order.push(1);
        resolve();
      });
    }));

    promises.push(new Promise((resolve) => {
      define(['./y.js'], () => {
        order.push(2);
        resolve();
      });
    }));

    await Promise.all(promises);
    assert.deepEqual(order, [0, 1, 2]);
  });

  test('can fail without blocking the next one', (done) => {
    // We order top-level modules by injecting dependencies between them.
    // However, unlike normal dependencies, if module 1 fails, we should still
    // execute module 2.
    define(['./not-found.js'], () => assert.fail());
    define([], () => done());
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
    let numErrors = 0;

    define(['require'], (require: any) => {
      require(
          ['./not-found-a.js', './not-found-b.js'],
          () => assert.fail(),
          () => numErrors++);
    });

    setTimeout(() => {
      assert.equal(numErrors, 1);
      done();
    }, 30);
  });
});

suite('meta.url', () => {
  test('top-level HTML document', (done) => {
    define(['meta'], (meta: any) => {
      assert.equal(meta.url.split('#')[0], document.baseURI);
      done();
    });
  });

  test('module at deeper path', (done) => {
    define(['./z/exports-meta.js'], (exportsMeta: any) => {
      assert.equal(
          exportsMeta.meta.url,
          document.baseURI!.split(/\/suite[^/]*\.html/)[0] +
              '/z/exports-meta.js');
      done();
    });
  });
});
