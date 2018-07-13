const fs = require('fs');
const gulp = require('gulp');
const path = require('path');
const rollup = require('rollup');
const ts = require('gulp-typescript');
const typescript = require('typescript');
const browserTsProject = ts.createProject('./tsconfig.json', {
    typescript
});
gulp.task('build', ['build:typescript-to-javascript'], (done) => {
    rollup.rollup({
        input: 'lib/index.js',
    }).then(function (bundle) {
        bundle.write({
            file: 'browser.js',
            indent: false,
            format: 'iife',
            // banner: fs.readFileSync('browser-js-header.js', 'utf-8'),
            intro: 'window.__wctUseNpm = true;',
            sourceMap: true,
            sourceMapFile: path.resolve('browser.js.map')
        }).then(function () {
            done();
        });
    }).catch(done);
});

gulp.task('build:typescript-to-javascript', () =>
    browserTsProject.src().pipe(
        browserTsProject(ts.reporter.nullReporter()))
            .js.pipe(gulp.dest('./lib/')));
