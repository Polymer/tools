/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';

const concat = require('gulp-concat');
const depcheck = require('depcheck');
const fs = require('fs');
const glob = require('glob');
const gulp = require('gulp');
const mocha = require('gulp-spawn-mocha');
const tslint = require('gulp-tslint');
const ts = require('gulp-typescript');
const bower = require('bower');
const path = require('path');
const rollup = require('rollup');
const typescript = require('typescript');

const mochaConfig = {
  reporter: 'spec',
  retries: 3,
  timeout: 90000
};

// const commonTools = require('tools-common/gulpfile');
const commonTools = {
  depcheck: commonDepCheck
};

// Meta tasks

function removeFile(path) {
  try {
    fs.unlinkSync(path);
    return;
  } catch (e) {
    try {
      fs.statSync(path);
    } catch (e) {
      return;
    }
    throw new Error('Unable to remove file: ' + path);
  }
}

gulp.task('clean', (done) => {
  removeFile('browser.js');
  removeFile('browser.js.map');
  const patterns = ['runner/*.js', 'browser/**/*.js', 'browser/**/*.js.map'];
  for (const pattern of patterns) {
    glob(pattern, (err, files) => {
      if (err) {
        return done(err);
      }
      try {
        for (const file of files) {
          removeFile(file);
        }
      } catch (e) {
        return done(e);
      }
    });
  }
  done();
});

const tsProject = ts.createProject('tsconfig.json', {typescript});
gulp.task('build:typescript-server', function() {
  // Ignore typescript errors, because gulp-typescript, like most things
  // gulp, can't be trusted.
  return tsProject.src()
      .pipe(tsProject(ts.reporter.nullReporter()))
      .js.pipe(gulp.dest('./'));
});

const browserTsProject =
    ts.createProject('browser/tsconfig.json', {typescript});
gulp.task('build:typescript-browser', function() {
  return browserTsProject.src()
      .pipe(browserTsProject(ts.reporter.nullReporter()))
      .js.pipe(gulp.dest('./browser/'));
});

// Specific tasks

gulp.task(
    'build:browser',
    gulp.series([
      'build:typescript-browser',
      function() {
        return rollup.rollup({
          entry: 'browser/index.js',
        })
        .then(function(bundle) {
          return bundle.write({
            indent: false,
            format: 'iife',
            banner: fs.readFileSync('browser-js-header.txt', 'utf-8'),
            intro: 'window.__wctUseNpm = false;',
            dest: 'browser.js',
            sourceMap: true,
            sourceMapFile: path.resolve('browser.js.map')
          });
        });
      }
    ]));

gulp.task('build:wct-browser-legacy:a11ySuite', function() {
  return gulp.src(['data/a11ySuite-npm-header.txt', 'data/a11ySuite.js'])
      .pipe(concat('a11ySuite.js'))
      .pipe(gulp.dest('../wct-browser-legacy/'));
});

gulp.task(
    'build:wct-browser-legacy:browser',
    gulp.series([
      'build:typescript-browser',
      function() {
        return rollup.rollup({
          entry: 'browser/index.js',
        })
        .then(function(bundle) {
          return bundle.write({
            indent: false,
            format: 'iife',
            banner: fs.readFileSync('browser-js-header.txt', 'utf-8'),
            intro: 'window.__wctUseNpm = true;',
            dest: '../wct-browser-legacy/browser.js',
            sourceMap: true,
            sourceMapFile: path.resolve('browser.js.map')
          });
        });
      }
    ]));

gulp.task('build:wct-browser-legacy', gulp.series([
  'build:wct-browser-legacy:a11ySuite',
  'build:wct-browser-legacy:browser',
]));


gulp.task('test:unit', function() {
  return gulp
      .src('test/unit/*.js', {
        read: false,
        timeout: 5000,
      })
      .pipe(mocha(mochaConfig));
});

gulp.task('bower', function() {
  return new Promise((resolve) => {
    bower.commands.install().on('end', resolve);
  });
});

gulp.task('test:integration', gulp.series(['bower']), function() {
  return gulp.src('test/integration/*.js', {read: false})
      .pipe(mocha(mochaConfig));
});

commonTools.depcheck({
  stickyDeps: new Set([
    // Used in browser.js
    'accessibility-developer-tools',
    'mocha',
    'test-fixture',
    '@polymer/sinonjs',
    '@polymer/test-fixture',
    '@webcomponents/webcomponentsjs',
    'async',
    'findup-sync',

    // Only included to satisfy peer dependency and suppress error on install
    'sinon',

    // Used in the wct binary
    'resolve'
  ])
});

gulp.task(
    'tslint',
    () => gulp.src([
                'runner/**/*.ts',
                '!runner/**/*.d.ts',
                'test/**/*.ts',
                '!test/**/*.d.ts',
                'custom_typings/*.d.ts',
                'browser/**/*.ts',
                '!browser/**/*.ts'
              ])
              .pipe(tslint())
              .pipe(tslint.report({formatter: 'verbose'})));

gulp.task('build', gulp.series([
  'build:typescript-server',
  'build:browser',
  'build:wct-browser-legacy'
]));

gulp.task('lint', gulp.series(['tslint', 'depcheck']));

gulp.task('test', gulp.series([
  'build:typescript-server',
  'lint',
  'test:unit',
  'test:integration'
]));

gulp.task('build-all', gulp.series([
  'clean',
  'lint',
  'build'
]));

gulp.task('default', gulp.series(['test']));

gulp.task('prepublish', gulp.series([
  // We can't run the integration tests here because on travis we may not
  // be running with an x instance when we do `npm install`. We can change
  // this to just `test` from `test:unit` once all supported npm versions
  // no longer run `prepublish` on install.
  'build-all',
  'test:unit'
]));

function commonDepCheck(options) {
  const defaultOptions = {stickyDeps: new Set()};
  options = Object.assign({}, defaultOptions, options);

  gulp.task('depcheck', () => {
    return new Promise((resolve, reject) => {
             depcheck(
                 __dirname,
                 {ignoreDirs: [], ignoreMatches: ['@types/*']},
                 resolve);
           })
        .then((result) => {
          const invalidFiles = Object.keys(result.invalidFiles) || [];
          const invalidJsFiles = invalidFiles.filter((f) => f.endsWith('.js'));

          if (invalidJsFiles.length > 0) {
            console.log('Invalid files:', result.invalidFiles);
            throw new Error('Invalid files');
          }

          const unused = new Set(result.dependencies);
          for (const falseUnused of options.stickyDeps) {
            unused.delete(falseUnused);
          }
          if (unused.size > 0) {
            console.log('Unused dependencies:', unused);
            throw new Error('Unused dependencies');
          }
        });
  });
}
