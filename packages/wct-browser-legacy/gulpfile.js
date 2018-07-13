const fs = require('fs');
const gulp = require('gulp');
const path = require('path');
const rollup = require('rollup');
const spawn = require('child_process').spawn;

gulp.task('build', ['build:browser']);

gulp.task('build:browser', ['build:wct-mocha'], function (done) {
    rollup.rollup({
        input: '../wct-mocha/lib/index.js',
    }).then(function (bundle) {
        bundle.write({
            file: 'browser.js',
            indent: false,
            format: 'iife',
            banner: fs.readFileSync('browser-js-header.js', 'utf-8'),
            intro: 'window.__wctUseNpm = true;',
            sourceMap: true,
            sourceMapFile: path.resolve('browser.js.map')
        }).then(function () {
            done();
        });
    }).catch(done);
});

gulp.task('build:wct-mocha', function (done) {
    // We don't need to bother building wct-mocha already built.
    if (fs.exists('../wct-mocha/lib/index.js')) {
        return done();
    }
    const wctMocha = spawn('lerna', [
        'exec',
        '--scope=wct-mocha',
        '--',
        'gulp build'
    ], { stdio: 'inherit' });
    wctMocha.on('close', (exitCode) => {
        if (exitCode !== 0) {
            done('exit code: ' + exitCode);
        } else {
            done();
        }
    });
});