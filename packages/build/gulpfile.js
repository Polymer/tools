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

'use strict';

const depcheck = require('depcheck');
const fs = require('fs-extra');
const gulp = require('gulp');
const mergeStream = require('merge-stream');
const mocha = require('gulp-spawn-mocha');
const path = require('path');
const runSeq = require('run-sequence');
const stream = require('stream');
const tslint = require('gulp-tslint');
const typescript = require('gulp-typescript');
const babelCore = require('@babel/core');
const sourcemaps = require('gulp-sourcemaps');

const babelPresetMinify =
    require('babel-preset-minify')({}, {simplifyComparisons: false});

const tsProject = typescript.createProject(
    'tsconfig.json', {typescript: require('typescript')});

gulp.task('lint', ['tslint', 'depcheck']);

gulp.task('clean', (done) => {
  fs.remove(path.join(__dirname, 'lib'), done);
});

gulp.task('build', (done) => {
  runSeq('clean', [
    'compile',
    'gen-babel-helpers-full',
    'gen-babel-helpers-amd',
    'gen-requirejs',
  ], done);
});

gulp.task('compile', () => {
  const tsResult = gulp.src(['src/**/*.ts', 'custom_typings/**/*.ts'])
                       .pipe(sourcemaps.init())
                       .pipe(tsProject(typescript.reporter.fullReporter()));

  return mergeStream(tsResult.js.pipe(sourcemaps.write('../lib')), tsResult.dts)
      .pipe(gulp.dest('lib'));
});

gulp.task('test', (done) => runSeq('build', 'test:unit', done));

gulp.task('test:unit', function() {
  return gulp.src('lib/test/**/*_test.js', {read: false}).pipe(mocha({
    ui: 'tdd',
    reporter: 'spec',
    timeout: 5000,
  }))
});

gulp.task('tslint', function() {
  return gulp.src('src/**/*.ts')
      .pipe(tslint({configuration: 'tslint.json', formatter: 'verbose'}))
      .pipe(tslint.report())
});

gulp.task('depcheck', function() {
  return depcheck(__dirname, {
           ignoreMatches: [
             // "@types/*" dependencies are type declarations that are
             // automatically loaded by TypeScript during build. depcheck can't
             // detect this so we ignore them here.

             '@types/*',
             // Also it can't yet parse files that use async iteration.
             // TODO(rictic): remove these
             'mz',
             'multipipe',
             'polymer-bundler',
             'parse5',
             'dom5',
             '@babel/traverse',
             'stream',
             'html-minifier',
           ]
         })
      .then((result) => {
        let invalidFiles = Object.keys(result.invalidFiles) || [];
        let invalidJsFiles = invalidFiles.filter((f) => f.endsWith('.js'));
        if (invalidJsFiles.length > 0) {
          throw new Error(`Invalid files: ${invalidJsFiles}`);
        }
        if (result.dependencies.length) {
          throw new Error(`Unused dependencies: ${result.dependencies}`);
        }
      });
});

/*
 * There doesn't seem to be documentation on what helpers are available, or
 * which helpers are required for which transforms. The
 * source is here:
 * https://github.com/babel/babel/tree/master/packages/babel-helpers
 *
 * You can usually tell what the helpers are used for by searching the babel
 * source to find out which plugin packages make an `addHelper` call for it.
 *
 * All helpers are listed here, with some commented out, so it's clear what
 * we've excluded.
 */
const mainHelpers = [

  // __proto__ assignment
  'defaults',
  'extends',

  // es2015 classes
  'assertThisInitialized',
  'classCallCheck',
  'construct',
  'createClass',
  'get',
  'getPrototypeOf',
  'inherits',
  //'inheritsLoose',
  'possibleConstructorReturn',
  'set',
  'setPrototypeOf',
  'superPropBase',
  'wrapNativeSuper',

  // es2015 array-spread
  'slicedToArray',
  //'slicedToArrayLoose',
  'toArray',
  'toConsumableArray',
  'arrayWithoutHoles',
  'arrayWithHoles',
  'iterableToArray',
  'iterableToArrayLimit',
  //'iterableToArrayLimitLoose',
  'nonIterableSpread',
  'nonIterableRest',

  // es2015 instanceof
  'instanceof',

  // es2015 arrow-functions
  'newArrowCheck',

  // es2015 typeof-symbol
  'typeof',

  // es2015 computed-properties
  'defineEnumerableProperties',
  'defineProperty',

  // es2015 block-scoping
  'readOnlyError',
  'temporalRef',
  'temporalUndefined',

  // es2015 destructuring
  'objectDestructuringEmpty',
  'objectWithoutProperties',

  // es2015 template-literals
  'taggedTemplateLiteral',
  //'taggedTemplateLiteralLoose',

  // es2017 async-to-generator
  'asyncToGenerator',

  // es2018 proposal-async-generator-functions
  'AsyncGenerator',
  'AwaitValue',
  'asyncGeneratorDelegate',
  'asyncIterator',
  'awaitAsyncGenerator',
  'wrapAsyncGenerator',

  // es2018 proposal-object-rest-spread
  'objectSpread',
  'toPropertyKey',

  // proposal-function-sent
  //'skipFirstGeneratorNext',

  // proposal-class-properties
  //'classNameTDZError',

  // proposal-decorators
  //'applyDecoratedDescriptor',
  //'initializerDefineProperty',
  //'initializerWarningHelper',

  // react-inline-elements
  //'jsx',
];

/**
 * Babel helpers needed only for ES module transformation. We bundle these with
 * the require.js AMD module loader instead so that the AMD transform does not
 * depend on loading all Babel helpers.
 */
const amdHelpers = [
  'interopRequireDefault',
  'interopRequireWildcard',
];

gulp.task('gen-babel-helpers-full', () => {
  minifyAndWriteJs(
      babelCore.buildExternalHelpers([...mainHelpers, ...amdHelpers]),
     'babel-helpers-full.min.js');
});

gulp.task('gen-babel-helpers-amd', () => {
  minifyAndWriteJs(
      babelCore.buildExternalHelpers(amdHelpers),
     'babel-helpers-amd.min.js');
});

gulp.task('gen-requirejs', () => {
  const requireJsPath =
      path.join(path.dirname(require.resolve('requirejs')), '..', 'require.js');
  const requireJsCode = fs.readFileSync(requireJsPath, 'utf-8');
  minifyAndWriteJs(requireJsCode, 'requirejs.min.js');
});

function minifyAndWriteJs(js, filename) {
  const minified =
      babelCore.transform(js, {presets: [babelPresetMinify]}).code;
  const libDir = path.join(__dirname, 'lib');
  fs.mkdirpSync(libDir);
  fs.writeFileSync(path.join(libDir, filename), minified, {encoding: 'utf-8'});
}
