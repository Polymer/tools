const gulp = require('gulp');
const logging = require('plylog');
const mergeStream = require('merge-stream');

const polymer = require('../../lib/polymer-build');

logging.setVerbose();

const PolymerProject = polymer.PolymerProject;
const fork = polymer.forkStream;

let project = new PolymerProject({
  root: process.cwd(),
  entrypoint: 'index.html',
  shell: 'shell.html',
});

gulp.task('test1', () => {

  // process source files in the project
  let sources = project.sources()
    .pipe(project.split())
    // add compilers or optimizers here!
    // TODO(justinfagnani): add in default optimizer passes
    .pipe(project.rejoin());

  // process dependencies
  let dependencies = project.dependencies()
    .pipe(project.split())
    // add compilers or optimizers here!
    // TODO(justinfagnani): add in default optimizer passes
    .pipe(project.rejoin());

  // merge the source and dependencies streams to we can analyze the project
  let allFiles = mergeStream(sources, dependencies)
    .pipe(project.analyze);

  // fork the stream in case downstream transformers mutate the files
  // this fork will vulcanize the project
  let bundled = fork(allFiles)
    .pipe(project.bundle)
    // write to the bundled folder
    // TODO(justinfagnani): allow filtering of files before writing
    .pipe(gulp.dest('build/bundled'));

  let unbundled = fork(allFiles)
    // write to the unbundled folder
    // TODO(justinfagnani): allow filtering of files before writing
    .pipe(gulp.dest('build/unbundled'));

  return mergeStream(bundled, unbundled);
});
