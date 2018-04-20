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

const fs = require('fs-extra');
const gulp = require('gulp');
const mocha = require('gulp-mocha');
const tslint_lib = require('gulp-tslint');
const typescript = require('gulp-typescript');
const mergeStream = require('merge-stream');
const path = require('path');
const runSequence = require('run-sequence');
const typescript_lib = require('typescript');

function task(name, deps, impl) {
  if (gulp.hasTask(name)) {
    throw new Error(
        `A task with the name ${JSON.stringify(name)} already exists!`);
  }
  gulp.task(name, deps, impl);
}

module.exports.depcheck = function depcheck(options) {
  const depcheck_lib = require('depcheck');
  const defaultOptions = {stickyDeps: new Set()};
  options = Object.assign({}, defaultOptions, options);

  task('depcheck', () => {
    return new Promise((resolve, reject) => {
      // Note that process.cwd() in a gulp task is the directory of the
      // running gulpfile. See e.g. https://github.com/gulpjs/gulp/issues/523
      depcheck_lib(process.cwd(), {ignoreDirs: []}, resolve);
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
      for (const dep of unused) {
        if (dep.startsWith('@types/')) {
          unused.delete(dep);
        }
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
  module.exports.eslint(options);
  module.exports.depcheck(options);
  task('lint', ['tslint', 'eslint', 'depcheck']);
}

function getJsonConfig(filename) {
  var placesToLook = [
    process.cwd(),
    __dirname,
  ];
  for (const directory of placesToLook) {
    try {
      return JSON.parse(
          fs.readFileSync(path.join(directory, filename), 'utf-8'));
    } catch (error) { /* don't care */ }
  }
  throw new Error('Could not find a .eslintrc.json. This should never happen.');
}

module.exports.tslint = function(options) {
  const defaultOptions = {tsSrcs: gulp.src('src/**/*.ts')};
  options = Object.assign({}, defaultOptions, options);
  const tslintConfig = getJsonConfig('tslint.json');
  task('tslint', () =>
      options.tsSrcs
        .pipe(tslint_lib({
          configuration: tslintConfig,
          formatter: 'verbose'
        }))
        .pipe(tslint_lib.report()));
}

module.exports.eslint = function(options) {
  const eslint_lib = require('gulp-eslint');
  const defaultOptions = {jsSrcs: gulp.src(['test/**/*.js', 'gulpfile.js'])};
  options = Object.assign({}, defaultOptions, options);
  const eslintConfig = getJsonConfig('.eslintrc.json');
  task('eslint', () =>
      options.jsSrcs
        .pipe(eslint_lib(eslintConfig))
        .pipe(eslint_lib.format())
        .pipe(eslint_lib.failAfterError()));
}

module.exports.build = function(options) {
  const defaultOptions = {
    tsSrcs: gulp.src('src/**/*.ts'),
    dataSrcs: gulp.src(['src/**/*', '!src/**/*.ts']),
  };
  options = Object.assign({}, defaultOptions, options);

  const tsProject =
    typescript.createProject('tsconfig.json', {typescript: typescript_lib});

  task('build', () =>
    mergeStream(
      options.tsSrcs.pipe(tsProject()),
      options.dataSrcs
    ).pipe(gulp.dest('lib'))
  );
}

module.exports.clean = function(options) {
  const defaultOptions = {buildArtifacts: ['lib/']};
  options = Object.assign({}, defaultOptions, options);

  task('clean', () => {
    for (const buildArtifact of options.buildArtifacts) {
      fs.removeSync(path.join(process.cwd(), buildArtifact));
    }
  });
}


module.exports.buildAll = function(options) {
  module.exports.clean(options);
  module.exports.init(options);
  module.exports.lint(options);
  module.exports.build(options);

  task('build-all', (done) => {
    runSequence('clean', 'init', 'lint', 'build', done);
  });
}

module.exports.test = function(options) {
  module.exports.buildAll(options);

  task('test', (done) => runSeq('build', 'test:unit', 'test:integration', done));
  
  task('test:integration', () =>
    gulp.src(['lib/test/integration/**/*_test.js'], {read: false})
        .pipe(mocha({
          ui: 'tdd',
          reporter: 'spec',
        })));

  task('test:unit', () =>
    gulp.src(['lib/test/unit/**/*_test.js'], {read: false})
        .pipe(mocha({
          ui: 'tdd',
          reporter: 'spec',
        })));
}

module.exports.generateCompleteTaskgraph = function(options) {
  module.exports.test(options);
}
