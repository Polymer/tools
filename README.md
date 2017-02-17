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

To create a new instance of `PolymerProject`, you'll need to give it some information about your application. If you already have a [`polymer.json`](https://www.polymer-project.org/1.0/docs/tools/polymer-cli#build) configuration file in your project, you can create a new `PolymerProject` instance by loading it directly:

```js
const PolymerProject = require('polymer-build').PolymerProject;

const project = new PolymerProject(require('./polymer.json'));
```

Or, you can pass in configuration options directly to the `PolymerProject` constructor:

```js
const PolymerProject = require('polymer-build').PolymerProject;

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

#### project.sources()

Returns a readable stream of your project's source files. By default, these are the files in your project's `src/` directory, but if you have additional source files this can be configured via the `sources` property in [`ProjectOptions`](src/polymer-project.ts).

#### project.dependencies()

Returns a readable stream of your project's dependencies. This stream is automatically populated based on the files loaded inside of your project. You can include additional dependencies via the `extraDependencies` property in [`ProjectOptions`](src/polymer-project.ts) (this can be useful when the analyzer fails to detect a necessary dependency.)

```js
const gulp = require('gulp');
const mergeStream = require('merge-stream');

// Create a build pipeline to pipe both streams together to the 'build/' dir
mergeStream(project.sources(), project.dependencies())
  .pipe(gulp.dest('build/'));
```


### Handling Inlined CSS/JS

#### HtmlSplitter

Web components will sometimes include inlined CSS & JavaScript. This can pose a problem for tools that weren't built to read those languages from inside HTML. To solve this, you can create an `HtmlSplitter` instance to extract inlined CSS & JavaScript into individual files in your build stream for processing (and then rejoin them later).

```js
const gulpif = require('gulp-if');
const uglify = require('gulp-uglify');
const cssSlam = require('css-slam').gulp;
const htmlMinifier = require('gulp-html-minifier');
const HtmlSplitter = require('polymer-build').HtmlSplitter;

const sourcesHtmlSplitter = new HtmlSplitter();
const sourcesStream = project.sources()
  .pipe(sourcesHtmlSplitter.split()) // split inline JS & CSS out into individual .js & .css files
  .pipe(gulpif(/\.js$/, uglify()))
  .pipe(gulpif(/\.css$/, cssSlam()))
  .pipe(gulpif(/\.html$/, htmlMinifier())) 
  .pipe(sourcesHtmlSplitter.rejoin()); // rejoins those files back into their original location

// NOTE: If you want to split/rejoin your dependencies stream as well, you'll need to create a new HtmlSplitter for that stream.
```

You can add splitters to any part of your build stream. We recommend using them to optimize your `sources()` and `dependencies()` streams individually as in the example above, but you can also optimize after merging the two together or even after bundling.


### Bundling Files

#### project.bundler

A stream that combines the files in your application to reduce the number of frontend requests needed. This can be a great way to [improve performance](https://developer.yahoo.com/performance/rules.html#num_http) when HTTP2/Push is not available.

By default, the bundler will create one "shared-bundle.html" containing all shared dependencies. You can optimize even further by defining "fragments" in your project options. Fragments are lazy loaded parts of the application, typically views and other elements loaded on-demand. When fragments are defined, the bundler is able to create smaller bundles containing code that is only required for specific fragments.

```js
const gulp = require('gulp');
const mergeStream = require('merge-stream');

// Create a build pipeline to bundle our application before writing to the 'build/' dir
mergeStream(project.sources(), project.dependencies())
  .pipe(project.bundler)
  .pipe(gulp.dest('build/'));
```


### Generating Service Workers

#### generateServiceWorker()

`generateServiceWorker()` will generate the service worker code based on your build. Unlike other parts of polymer-build, `generateServiceWorker()` returns a promise and not a stream. It can only be run **after** your build has finished writing to disk, so that it is able to analyze the entire build as it exists.

For bundled builds, be sure to set the bundled option to `true`. See [AddServiceWorkerOptions](src/service-worker.ts) for a list of all supported options.

```js
const generateServiceWorker = require('polymer-build').generateServiceWorker;

generateServiceWorker({
  buildRoot: 'build/',
  project: project,
  bundled: true, // set if `project.bundler` was used
  swPrecacheConfig: {
    // See https://github.com/GoogleChrome/sw-precache#options-parameter for all supported options
    navigateFallback: '/index.html',
  }
}).then(() => { // ...
```

`generateServiceWorker()` is built on top of the [sw-precache](https://github.com/GoogleChrome/sw-precache) library. Any options it supports can be passed directly to that library via the `swPrecacheConfig` option. See [sw-preache](https://github.com/GoogleChrome/sw-precache#options-parameter) for a list of all supported options

In some cases you may need to whitelist 3rd party services with sw-precache, so the Service Worker doesn't intercept them. For instance, if you're hosting your app on Firebase, you'll want to add the `navigateFallbackWhitelist: [/^(?!\/__)/]` option to your `swPrecacheConfig` as Firebase owns the `__` namespace, and intercepting it will cause things like OAuth to fail.

#### addServiceWorker()

Like `generateServiceWorker()`, but writes the generated service worker to the file path you specify in the `path` option ("service-worker.js" by default).

```js
const addServiceWorker = require('polymer-build').addServiceWorker;

addServiceWorker({
  buildRoot: 'build/',
  project: project,
}).then(() => { // ...
```


### Multiple Builds

#### forkStream(stream)

Sometimes you'll want to pipe a build to multiple destinations. `forkStream()` creates a new stream that copies the original stream, cloning all files that pass through it.

```js
const gulp = require('gulp');
const mergeStream = require('merge-stream');
const forkStream = require('polymer-build').forkStream;

// Create a combined build stream of your application files
const buildStream = mergeStream(project.sources(), project.dependencies());

// Fork your build stream to write directly to the 'build/unbundled' dir
const unbundledBuildStream = forkStream(buildStream)
  .pipe(gulp.dest('build/unbundled'));

// Fork your build stream to bundle your application and write to the 'build/bundled' dir
const bundledBuildStream = forkStream(buildStream)
  .pipe(project.bundler)
  .pipe(gulp.dest('build/bundled'));
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

