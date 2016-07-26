const gulp = require('gulp');
const logging = require('plylog');
const mergeStream = require('merge-stream');

const polymer = require('../../lib/polymer-build');

logging.setVerbose();

const PolymerProject = polymer.PolymerProject;
const fork = polymer.forkStream;
const addServiceWorker = polymer.addServiceWorker;

/**
 * Waits for the given ReadableStream
 */
function waitFor(stream) {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

let project = new PolymerProject({
  root: process.cwd(),
  entrypoint: 'index.html',
  shell: 'shell.html',
});

gulp.task('test1', () => {

  let swConfig = {
    staticFileGlobs: [
      '/index.html',
      '/shell.html',
      '/source-dir/**',
    ],
    navigateFallback: '/index.html',
  };

  // process source files in the project
  let sources = project.sources()
    .pipe(project.splitHtml())
    // add compilers or optimizers here!
    // TODO(justinfagnani): add in default optimizer passes
    .pipe(project.rejoinHtml());

  // process dependencies
  let dependencies = project.dependencies()
    .pipe(project.splitHtml())
    // add compilers or optimizers here!
    // TODO(justinfagnani): add in default optimizer passes
    .pipe(project.rejoinHtml());

  // merge the source and dependencies streams to we can analyze the project
  let allFiles = mergeStream(sources, dependencies)
    .pipe(project.analyzer);

  // fork the stream in case downstream transformers mutate the files
  // this fork will vulcanize the project
  let bundled = fork(allFiles)
    .pipe(project.bundler)
    // write to the bundled folder
    // TODO(justinfagnani): allow filtering of files before writing
    .pipe(gulp.dest('build/bundled'));

  let unbundled = fork(allFiles)
    // write to the unbundled folder
    // TODO(justinfagnani): allow filtering of files before writing
    .pipe(gulp.dest('build/unbundled'));

  return Promise.all([waitFor(bundled), waitFor(unbundled)]).then(() => {
    return Promise.all([
      addServiceWorker({
        project: project,
        buildRoot: 'build/unbundled',
        swConfig: swConfig,
        serviceWorkerPath: 'test-custom-sw-path.js',
      }),
      addServiceWorker({
        project: project,
        buildRoot: 'build/bundled',
        swConfig: swConfig,
        bundled: true,
      }),
    ]);
  });

});
