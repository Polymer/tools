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

task('init', () => gulp.src("./typings.json").pipe(typings()));

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
    if (unused.size > 0) {
      console.log('Unused dependencies:', unused);
      throw new Error('Unused dependencies');
    }
  });
});

task('lint', ['tslint', 'eslint', 'depcheck']);

task('tslint', () =>
    gulp.src('src/**/*.ts')
      .pipe(tslint_lib({
        configuration: 'tslint.json',
      }))
      .pipe(tslint_lib.report('verbose')));

task('eslint', () =>
    gulp.src('test/**/*.js')
      .pipe(eslint())
      .pipe(eslint.format())
      .pipe(eslint.failAfterError()));

const tsProject = typescript.createProject('tsconfig.json');

task('build', () =>
  mergeStream(
    tsProject.src().pipe(typescript(tsProject)),
    gulp.src(['src/**/*', '!src/**/*.ts'])
  ).pipe(gulp.dest('lib'))
);

task('clean', () => {
  for (const buildArtifact of ['lib']) {
    fs.removeSync(path.join(__dirname, buildArtifact));
  }
});

task('build-all', (done) => {
  runSeq('clean', 'init', 'lint', 'build', done);
});

task('test', ['build'], () =>
  gulp.src('test/**/*_test.js', {read: false})
      .pipe(mocha({
        ui: 'tdd',
        reporter: 'spec',
      }))
);
