# polymer-build

polymer-build is a library for building Polymer projects.


## Installation

```
npm install --save-dev polymer-build
```


## Relationship to Polymer CLI

The [Polymer CLI](https://github.com/Polymer/polymer-cli) uses polymer-build under the hood, so you can think of the CLI's `build` command like running a pre-configured polymer-build pipeline. Setting this up for you makes the CLI easy to use, but as a command-line wrapper its customization options are more limited. polymer-build allows you to completely customize your build and combine additional streams and build tasks in any order.

Consider using polymer-build instead of the CLI if you:

- Want to customize your build(s) without using the Polymer CLI
- Need to run your source code through custom optimizers/processors before, after, or during your build
- Need to hook additional work into any part of the build process


## Usage

While polymer-build was built to work easily with Gulp, it can be used in any Node.js environment. polymer-build is built on Node.js streams, and the build pipeline that you create with it is not much more than a series of connected streams. Files are represented as [Vinyl](https://github.com/gulpjs/vinyl) file objects, which means that polymer-build can interop with any existing Gulp/Vinyl streams.

Check out the [custom-build generator](https://github.com/PolymerElements/generator-polymer-init-custom-build) for an example of how polymer-build can be used to build a project.


### PolymerProject

`PolymerProject` represents your project in the build pipeline. Once configured, it will give you access to a collection of streams and helpers for building your project.

To create a new instance of PolymerProject, you'll need to give it some information about your project. See the [`ProjectOptions`](src/polymer-project.ts) definition for a full list of all supported options.

```js
const project = new PolymerProject({
  entrypoint: 'index.html',
  shell: 'src/my-app.html',
  fragments: [
    'src/my-view1.html',
    'src/my-view2.html',
    'src/my-view3.html'
  ]
});
```

> **NOTE:** If you've previously used the Polymer CLI to build your project, these options are the same information that's held in your project's `polymer.json` file. If you prefer, you can continue to store these values in that file and then load them here.

> ```js
const project = new PolymerProject(require('./polymer.json'));
```

#### project.sources()

Returns a readable stream of your project's source files. By default, these are the files in your project's `src/` directory, but if you have additional source files this can be configured via the `sourceGlobs` property in [`ProjectOptions`](src/polymer-project.ts).

#### project.dependencies()

Returns a readable stream of your project's dependencies. This stream is automatically populated based on the files loaded inside of your project. You can include additional dependencies via the `includeDependencies` property in [`ProjectOptions`](src/polymer-project.ts) (this can be useful when the analyzer fails to detect a necessary dependency.)

#### project.analyzer

A stream that analyzes your project as files pass through it. Files pass through it untouched (although they may exit in a different order than they entered). The analyzer enables a lot of the more powerful features of polymer-build, like smart dependency analysis & bundling.

**polymer.analyzer is a required step in your build-pipeline!** Be sure to pipe all files through it before piping out to your build destination(s). If dependencies aren't piped to `project.analyzer` the analyzer will hang.

```js
const gulp = require('gulp');
const mergeStream = require('merge-stream');

// pipe both streams
mergeStream(project.sources(), project.dependencies())
  .pipe(project.analyzer)
  .pipe(gulp.dest('build/'));
```


### Bundling Files

#### project.bundler

A stream that combines the files in your application to reduce the number of frontend requests needed. This can be a great way to [improve performance](https://developer.yahoo.com/performance/rules.html#num_http) when HTTP2/Push is not available.

By default, the bundler will create one "shared-bundle.html" containing all shared dependencies. You can optimize even further by defining "fragments" in your project options. Fragments are lazy loaded parts of the application, typically views and other elements loaded on-demand. When fragments are defined, the bundler is able to create smaller bundles containing code that is only required for specific fragments.

```js
const gulp = require('gulp');
const mergeStream = require('merge-stream');

// pipe both streams
mergeStream(project.sources(), project.dependencies())
  .pipe(project.analyzer)
  .pipe(project.bundler)
  .pipe(gulp.dest('build/'));
```


### Extracting Inlined CSS/JS

#### project.splitHtml() & project.rejoinHtml()

Web components will sometimes include inlined CSS & JavaScript. This can be a problem for tools that weren't built to read HTML. To get around this, you can include the optional `splitHtml()` and `rejoinHtml()` streams.

`project.splitHtml()` returns a stream that extracts any inlined CSS & JS into individual files. This can be useful for running your files through additional tools that don't handle inline code very well.

Note that this should be a temporary part of your overall build pipeline. Split files should always be rejoined with `project.rejoinHtml()` as soon as possible in the pipeline.

```js
const gulpif = require('gulp-if');
const uglify = require('gulp-uglify');
const cssSlam = require('css-slam').gulp;
const htmlMinifier = require('gulp-html-minifier');
const mergeStream = require('merge-stream');

const sourcesStream = polymerProject.sources()
  .pipe(polymerProject.splitHtml())
  .pipe(gulpif(/\.js$/, uglify()))
  .pipe(gulpif(/\.css$/, cssSlam()))
  .pipe(gulpif(/\.html$/, htmlMinifier()))
  .pipe(polymerProject.rejoinHtml());

// not shown: project.dependencies() can also be split & optimized

mergeStream(sourcesStream, project.dependencies())
  .pipe(project.analyzer)
  .pipe(gulp.dest('build/'));
```


### Generating Service Workers

#### generateServiceWorker()

`generateServiceWorker()` will generate the service worker code based on your build. Unlike other parts of polymer-build, `generateServiceWorker()` returns a promise and not a stream. It can only be run **after** your build has finished writing to disk, so that it is able to analyze the entire build as it exists.

`generateServiceWorker()` is built on top of the [sw-precache](https://github.com/GoogleChrome/sw-precache) library. Any options it supports can be passed directly to that library via the `swConfig` option.

For bundled builds, be sure to set the bundled option to `true`. See [AddServiceWorkerOptions](src/service-worker.ts) for a list of all supported options.

```js
const generateServiceWorker = require('polymer-build').generateServiceWorker;

generateServiceWorker({
  buildRoot: 'build/',
  project: polymerProject,
  bundled: true // set if `polymerProject.bundler` was used
  swConfig: {
    // See https://github.com/GoogleChrome/sw-precache for all supported options
    navigateFallback: '/index.html',
  }
}).then(() => { // ...
```

#### addServiceWorker()

Like `generateServiceWorker()`, but writes the generated service worker to the file path you specify in the `serviceWorkerPath` option ("service-worker.js" by default).

```js
const addServiceWorker = require('polymer-build').addServiceWorker;

addServiceWorker({
  buildRoot: 'build/',
  project: polymerProject,
}).then(() => { // ...
```


### Multiple Builds

#### forkStream(stream)

Sometimes you'll want to pipe a build to multiple destinations. `forkStream()` creates a new stream that copies the original stream, cloning all files that pass through it.

```js
const mergeStream = require('merge-stream');
const forkStream = require('polymer-build').forkStream;

const buildStream = mergeStream(project.sources(), project.dependencies())
  .pipe(project.analyzer);

const unbundledBuildStream = forkStream(buildStream)
  .pipe(dest('build/unbundled'));

const bundledBuildStream = forkStream(buildStream)
  .pipe(polymerProject.bundler)
  .pipe(dest('build/bundled'));
```


## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

You can compile polymer-build from source by cloning the repo and then running `npm run build`. Make sure you have already run `npm install` before compiling.


## Supported Node.js Versions

polymer-build officially supports the latest LTS (4.x) and stable (6.x) versions of Node.js.

