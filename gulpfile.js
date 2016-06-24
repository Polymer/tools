/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

const depcheck_lib = require('depcheck');
const eslint_lib = require('gulp-eslint');
const fs = require('fs-extra');
const gulp = require('gulp');
const mergeStream = require('merge-stream');
const mocha = require('gulp-mocha');
const path = require('path');
const runSeq = require('run-sequence');
const tslint_lib = require("gulp-tslint");
const typescript = require('gulp-typescript');
const typings = require('gulp-typings');

function task(name, deps, impl) {
  if (gulp.hasTask(name)) {
    throw new Error(
        `A task with the name ${JSON.stringify(name)} already exists!`);
  }
  gulp.task(name, deps, impl);
}

module.exports.init = function() {
  task('init', () => gulp.src("./typings.json").pipe(typings()));
}

module.exports.depcheck = function depcheck(options) {
  const defaultOptions = {stickyDeps: new Set()};
  options = Object.assign({}, defaultOptions, options);

  task('depcheck', () => {
    return new Promise((resolve, reject) => {
      depcheck_lib(__dirname, {ignoreDirs: []}, resolve);
    }).then((result) => {
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

module.exports.lint = function(options) {
  module.exports.tslint(options);
  module.exports.eslint_lib(options);
  module.exports.depcheck(options);
  task('lint', ['tslint', 'eslint', 'depcheck']);
}

module.exports.tslint = function(options) {
  const defaultOptions = {tsSrcs: gulp.src('src/**/*.ts')};
  options = Object.assign({}, defaultOptions, options);
  task('tslint', () =>
      options.tsSrcs
        .pipe(tslint_lib({
          configuration: 'tslint.json',
        }))
        .pipe(tslint_lib.report('verbose')));
}

module.exports.eslint = function(options) {
  const defaultOptions = {jsSrcs: gulp.src('test/**/*.js')};
  options = Object.assign({}, defaultOptions, options);
  task('eslint', () =>
      options.jsSrcs
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError()));
}

module.exports.build = function(options) {
  const defaultOptions = {
    tsSrcs: gulp.src('src/**/*.ts'),
    dataSrcs: gulp.src(['src/**/*', '!src/**/*.ts'])
  };
  options = Object.assign({}, defaultOptions, options);

  const tsProject = typescript.createProject('tsconfig.json');

  task('build', () =>
    mergeStream(
      options.tsSrcs.pipe(typescript(tsProject)),
      options.dataSrcs
    ).pipe(gulp.dest('lib'))
  );
}

module.exports.clean = function(options) {
  const defaultOptions = {buildArtifacts: ['lib']};
  options = Object.assign({}, defaultOptions, options);

  task('clean', () => {
    for (const buildArtifact of options.buildArtifacts) {
      fs.removeSync(path.join(__dirname, buildArtifact));
    }
  });
}


module.exports.buildAll = function(options) {
  module.exports.clean(options);
  module.exports.init(options);
  module.exports.lint(options);
  module.exports.build(options);

  task('build-all', (done) => {
    runSeq('clean', 'init', 'lint', 'build', done);
  });
}

module.exports.test = function(options) {
  module.exports.buildAll(options);

  task('test', ['build'], () =>
    gulp.src('test/**/*_test.js', {read: false})
        .pipe(mocha({
          ui: 'tdd',
          reporter: 'spec',
        }))
  );
}
