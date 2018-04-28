/* tslint:disable no-any exports are untyped */

const {assert} = chai;
const define = window.define;

// Test data is laid out as follows:
//
// .
// ├── x.js (module with no dependencies)
// └── y
//     ├── suite.html (base HTML document)
//     ├── suite.min.html (same as suite.html but uses minified amd-loader)
//     ├── y.js (module with no dependencies)
//     ├── no-define.js (module which does not call define)
//     └── z
//         ├── z.js (module which depends on x.js)
//         └── exports-meta.js (module which exports its own meta)
//
// All of the test module scripts will throw if they are executed more than
// once.

test('define an empty module', (done) => {
  define([], () => done());
});

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

test('dynamic require', (done) => {
  define(['require'], (require: any) => {
    require(['./y.js'], function(y: any) {
      assert.deepEqual(y.y, 'y');
      done();
    });
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

suite('error handling', () => {
  test('do not resolve when static dependency 404s', (done) => {
    define(['./not-found.js'], () => assert.fail());
    setTimeout(done, 30);
  });

  test.skip('invoke error callback when dynamic dependency 404s', (done) => {
    define(['require'], (require: any) => {
      require(['./not-found.js'], () => assert.fail(), (err: any) => {
        assert.include(err.toString(), 'not-found.js');
        done();
      });
    });
  });
});
