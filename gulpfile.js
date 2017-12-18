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

const depcheck_lib = require('depcheck');
const fs = require('fs-extra');
const gulp = require('gulp');
const eslint_lib = require('gulp-eslint');
const mocha = require('gulp-mocha');
const newer = require('gulp-newer');
const shell = require('gulp-shell');
const sourcemaps = require('gulp-sourcemaps');
const tslint_lib = require('gulp-tslint');
const typescript = require('gulp-typescript');
const mergeStream = require('merge-stream');
const path = require('path');
const runSeq = require('run-sequence');
const typescript_lib = require('typescript');
const child_process = require('child_process');


function task(name, deps, impl) {
  if (gulp.hasTask(name)) {
    throw new Error(
      `A task with the name ${JSON.stringify(name)} already exists!`);
  }
  gulp.task(name, deps, impl);
}

task('init');

task('depcheck', function () {
  return new Promise((resolve, reject) => {
    depcheck_lib(
      __dirname,
      {
        ignoreDirs: [], ignoreMatches: [
          '@types/*', 'polymer-project-config']
      },
      resolve);
  })
    .then((result) => {
      const invalidFiles = Object.keys(result.invalidFiles) || [];
      const invalidJsFiles = invalidFiles.filter((f) => f.endsWith('.js'));

      const unused = new Set(result.dependencies);
      if (unused.size > 0) {
        console.log('Unused dependencies:', unused);
        throw new Error('Unused dependencies');
      }
    });
});

task('lint', ['tslint', 'depcheck']);

task('tslint', function () {
  return gulp.src('src/**/*.ts')
    .pipe(tslint_lib({
      configuration: 'tslint.json',
      formatter: 'verbose',
    }))
    .pipe(tslint_lib.report());
});

const tsProject =
  typescript.createProject('tsconfig.json', { typescript: typescript_lib });

task('build', ['compile', 'json-schema']);

task('compile', function () {
  const srcs =
    gulp.src('src/**/*.ts');  //.pipe(newer({dest: 'lib', ext: '.js'}));
  const tsResult =
    srcs.pipe(sourcemaps.init())
      .pipe(typescript(tsProject, [], typescript.reporter.fullReporter()));

  // Use this once typescript-gulp supports `include` in tsconfig:
  // const srcs = tsProject.src();
  return mergeStream(
             tsResult.js.pipe(sourcemaps.write('../lib')),
             tsResult.dts)
      .pipe(gulp.dest('lib'));
});

task('clean', () => {
  for (const buildArtifact of ['lib']) {
    fs.removeSync(path.join(__dirname, buildArtifact));
  }
});

task('build-all', (done) => {
  return runSeq('clean', 'init', 'lint', 'build', done);
});

task('test', ['build'], () => {
  return gulp.src('test/**/*_test.js').pipe(mocha({
    ui: 'tdd',
    reporter: 'spec',
  }));
});

task('json-schema', function () {
  const inPath = 'src/analysis-format/analysis-format.ts';
  const outPath = 'lib/analysis.schema.json';
  const command = path.normalize(`node_modules/.bin/typescript-json-schema`);
  const child = child_process.spawn(command, [`--required`, `${inPath}`, `Analysis`], { shell: true, cwd: process.cwd(), hideWindows: true });
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });
  const childFinished = new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject();
      }
    });
  });
  return childFinished.then(() => {
    fs.writeFileSync(outPath, buffer, 'utf8');
  });
});
