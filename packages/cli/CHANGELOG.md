# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!-- ## Unreleased -->
<!-- Add new, unreleased changes here. -->

## v1.9.5 [01-10-2019]
* Add `--help` description for `--version`.
* Updated dependencies for bug fixes and reduced package sizes.
  * polymer-analyzer@3.2.2 - 50% smaller package.
  * polymer-bundler@4.0.5 - 50% smaller package and a fix to external
    es6 module inlining bug.

## v1.9.4 [12-23-2018]
* Updated dependencies.
  * web-component-tester@6.9.2 - Fix gulpfile to actually build browser.js.

## v1.9.3 [12-19-2018]
* Replace `github` library with `@octokit/rest` to pass npm audit.

## v1.9.2 [12-06-2018]
* Updated dependencies.
  * @polymer/esm-amd-loader@1.0.4 - loads AMD modules with
    `crossorigin=anonymous` by default to match native module script
    behavior.

## v1.9.1 [11-15-2018]
* Updated dependencies.

## v1.9.0 [11-12-2018]
* Polymer 3.x templates now use lighter-weight dependency-free `wct-mocha`
  for testing.

## v1.9.0-pre.2 [10-25-2018]
* Include latest official `web-component-tester` update adding
  support for `wct-mocha` alternative to `wct-browser-legacy` package.
* Update `wct-local` to fix Firefox 63 testing issue with outdated
  geckodriver.

## v1.9.0-pre.1 [10-15-2018]
* Fix an issue where we were passing lint rule help text through chalk
  with unescaped chalk-specific syntax, causing chalk parsing errors.

## v1.8.1 [10-25-2018]
* Update package-lock to pickup wct-local 2.1.3 to fix Firefox 63 testing.

## v1.8.0 [08-15-2018]
* Fix a case where the CustomElementsEs5Adapter script was not added to the
  builds when the `js.compile` is an object with a target property of es5.
* Updated web-component-tester to v6.8.0, which changes the set of browsers
  when testing on Travis CI.

## v1.7.7 [06-28-2018]
* Update dependencies.

## v1.7.6 [06-25-2018]
* Node 10.5+ now supported!
* Breaks Node 6; using Node's built-in promisify, which is not available in
  versions of Node prior to 8.

## v1.7.4 [06-19-2018]
* Regenerate shrinkwrap to pick up latest dependencies.
* Fix issue caused by previous update where `polymer test -s` flag could not
  be used multiple times.
* Fix incorrect relative paths to the component directory in push manifests.
* Fix push manifest generation crash with ES module projects.

## v1.7.3 [06-11-2018]
* Regenerate shrinkwrap to pick up latest dependencies.

## v1.7.2 [05-11-2018]
* Fix bug in `polymer-3-element` init template where `polymer/dom-module.js`
  could be loaded twice when serving from the polyserve `/components/`
  directory.
* Fix names of `uncompiled-bundled` and `uncompiled-unbundled` build presets.

## v1.7.1 [05-09-2018]
* Workaround an NPM shrinkwrap bug which was causing users to install the CLI's
  250MB of devDependencies unnecessarily.
* Fixed polymer 3.x application and element templates to use the `html` tagged
  template literal function.

## v1.7.0 [05-08-2018]
* Fix bug with `init` templates and missing `.gitignore` files due to npm
  renaming them to `.npmignore` on install of cli.
* Fix `test` bug which broke Windows support relating to path delimeters.
* Change the default value of --module-resolution to "node".
* Polymer `lint` and `analyze`, when run without files, will look for sources
  from your `polymer.json` file. If none are given, it will scan all matching
  files as before.
  - Specifically it considers any files listed in `sources`, `fragments`,
    `shell`, and `entrypoint` as the source files for your project, and will
    ignore all others.
* Updated dependencies.

## v1.7.0-pre.17 [05-03-2018]
* The transform for `import.meta` now uses the special `"meta"` dependency
  provided by
  [@polymer/esm-amd-loader](https://github.com/Polymer/tools/tree/master/packages/esm-amd-loader),
  instead of injecting a static path. As a result, it is now always coupled with
  the AMD transform, and cannot be enabled independently.
* The [regenerator runtime](https://github.com/facebook/regenerator) is now
  injected into projects that are compiling to ES5. This is needed to support
  async/await and generators. `serve` will include the runtime in each script
  where it is used while `build` will include it once, inline, in the entrypoint
  HTML file.
* Added es5, es2015, es2016, es2017, and es2018 compile targets to the
  `js.compile` option of `polymer.json`, to allow fine grained control over
  which JavaScript features to compile during `build`.

## v1.7.0-pre.16 [05-01-2018]
* Dropped support for node v6. This is a soft break, as we aren't
  making any changes that are known to break node v6, but we're no longer testing against it. See our [node version support policy](https://www.polymer-project.org/2.0/docs/tools/node-support)
  for details.
* `build`:
  * Disable the `simplify` babel plugin when minifying javascript. See
    https://github.com/babel/minify/issues/824
  * Disable the `mangle` babel plugin as well. See
    https://github.com/Polymer/tools/issues/261
* `serve`:
  * Fixed issue where resources would be cached after restarting with
    different compilation/transformation options. We've turned off most
    browser-side caching. As a reminder: do not use `polymser serve` as a
    production webserver, it is designed for development.
* `serve`, `build`:
  * Replaced RequireJS AMD loader with
    [@polymer/esm-amd-loader](https://github.com/Polymer/tools/tree/master/packages/esm-amd-loader),
    which is smaller and better emulates the behavior of ES modules.
  * Add "webcomponents-bundle.js" to the heuristic used to determine when to
    inject the Custom Elements ES5 Adapter.

## v1.7.0-pre.15 [04-25-2018]
* `@babel/preset-es2015` has been replaced with a manually-created version so that `@babel/plugin-transform-classes` can be pinned to v7.0.0-beta.35 to avoid a bug where the polyfilled HTMLElement constructor is not called. (https://github.com/babel/babel/issues/7506)
* Rewritten dynamic `import()` calls now test if a bundle has exports before attempting to destructure bundle.

## v1.7.0-pre.14 [04-23-2018]
* `init`:
  * Fixed a bug which caused `.gitignore` to be excluded from published templates.
* `build`:
  * Disable Babel `minify-constant-folding` plugin when minifying. This plugin has a bug that breaks when a constant is exported from a module (https://github.com/babel/minify/issues/820).
  * Added `--auto-base-path` flag. Sets the entrypoint `<base>` tag for all builds to match the name of that build. Unlike other flags, does not necessarily trigger a single one-off build.
* `serve`, `test`:
  * Stricter requirements for determining when a browser supports modules, and
    hence when to automatically transform modules to AMD. We now require support
    for dynamic import and import.meta.

<!-- Add new, unreleased items here. -->

## v1.7.0-pre.13 [04-19-2018]
* `init`
  * Added the `polymer-3-starter-kit` template; a (prerelease) version of
    Polymer Starter Kit, ported to Polymer 3.

## v1.7.0-pre.12 [04-18-2018]
* `serve`
  * Fix node module resolution for the case where the root package is served
    from the components/ directory and imports a module from its own package
    using a path.

## v1.7.0-pre.11 [04-17-2018]
* `build`
  * The Babel helpers script now includes all Babel helpers that could be used by the ES5 compilation and AMD transforms.
  * Inline JavaScript will now only be transformed to AMD modules if they have type=module.
  * External JavaScript files will now only be transformed to AMD modules if they contain module import/export syntax.

## v1.7.0-pre.10 [04-12-2018]
* Pick up latest fixes to web-component-tester.

## v1.7.0-pre.9 [04-11-2018]
* Fix AMD transform bug where if an HTML document had multiple type=module scripts, and any of them (apart from the first) had any kind of import, then that import was not accessible (because it was mapped to the wrong module callback function argument).
* Update to latest web-component-tester.

## v1.7.0-pre.8 [04-11-2018]
* Fix broken release.

## v1.7.0-pre.7 [04-10-2018]
* Update polyserve for latest changes.

## v1.7.0-pre.6 [04-09-2018]
* Bring in latest polymer-analyzer and polymer-build fixes to node resolution
  and babel helpers.

## v1.7.0-pre.4 [04-05-2018]
- `build`
  - ES modules are now be bundled.
  - ES modules can now be transformed to AMD modules.
  - Minification and other transforms now happen after bundling instead of before.

## v1.7.0-pre.3 [03-22-2018]
- Fix -—module-resolution default from polyserve overriding polymer.json

## v1.7.0-pre.2 [03-22-2018]
- Fixed issue where the `--module-resolution` wasn't being handled for the `serve` command.

## v1.7.0-pre.1 [03-21-2018]
- Added `--npm` and `--component-dir` global flags, which are passed to the `build`, `lint`, `test`, and `serve` commands.
- All dash-case command line arguments are now converted to camelCase before overwriting options from polymer.json.
- Compile/minify steps can now parse object-rest-spread and dynamic-import.
- Fixed [issue #950](https://github.com/Polymer/polymer-cli/issues/950) where tagged template literals (such as `Polymer.html`) were incorrectly transpiled
- Automatically generate a `.gitignore` file when execute init command and select `element` or `application`.
- Added ability to use globs on `analyze` and `lint` commands
- JS compile build transformer will now rewrite bare module specifiers to paths.
- Add `--module-resolution` flag which can be `none` (the default) or `node`.
- Update dependencies.

## v1.6.0 [02-02-2018]
- Added support for `exclude` option in `polymer.json` for the build command's `minify` and `compile` options for `css`, `js` and `html` files.
- Added `--fix` option to `polymer lint`. When passed, some warnings with simple mechanical solutions will be fixed.
  - Also supports warnings which can be addressed with less-safe changes via
    an interactive prompt and the `--edits` flag. See `polymer lint --help` for
    more info.
- Added `--watch` (shorthand `-w`) option to `polymer lint`. When passed, we will watch the filesystem for changes and rerun the linter immediately afterwards.
  - Also works with `--fix` to automatically fix and report warnings as you work!
- `build` Added a CLI argument for setting the `basePath` option: `--base-path`.
- Derives node version check from the package.json.
- The polymer.json project config can now specify paths to exclude when minifying files and compiling JavaScript.  See https://github.com/Polymer/polymer-project-config/issues/50 for more.

## v1.5.7 [10-11-2017]
- Updated css-slam, bower and other dependencies.

## v1.5.6 [10-02-2017]
- Updated Polymer 2.0 element test file template to use ES6.
- Update JS minification package babili to the new package-name babel-minify.
- Updated to latest WCT and Polyserve versions to support npm and `<script type=module>` in on-the-fly compilation and tests.

## v1.5.5 [09-21-2017]
- Upgraded web-component-tester to v6.2.0 and polyserve 0.22.1 for better ES module support.

## v1.5.4 [08-31-2017]
- Upgraded web-component-tester to v6.1.5 to address IE11 issues.

## v1.5.3 [08-31-2017]
- Upgraded web-component-tester to v6.1.4 to address IE11 issues.

## v1.5.2 [08-26-2017]
- Upgraded web-component-tester to v6.1.3 to address yarn installation issues.

## v1.5.1 [08-22-2017]
- Upgraded web-component-tester to v6.1.2.

## v1.5.0 [08-22-2017]
- Fix issue where the `--fragment` flag was being ignored.
- Added support for `polymer test --npm` option.

## v1.4.1 [08-10-2017]
- Fixed the `polymer serve --npm` option.

## v1.4.0 [08-08-2017]
- Upgraded to Polymer Build ^2.0.0 which uses Polymer Bundler ^3.0.0.
- When no specific option is set for Bundler's `rewriteUrlsInTemplates` the CLI attempts to get the version of Polymer for the project using `bower`.  When Polymer 2.x is discovered, `rewriteUrlsInTemplates` is defaulted to `false`.  In case of Polymer 1.x or where version can not be identified, it defaults to `true`.  Any user settings override these defaults.
- Fix issue where negative `extraDependencies` globs were not working.
- test: Add support for WCT `config-file` option.

## v1.3.1 [07-06-2017]
- Fixed [issue #710](https://github.com/Polymer/polymer-cli/issues/710) where the es5 custom elements adapter would not be added when bundling.
- Fixed [issue #767](https://github.com/Polymer/polymer-cli/issues/767) where hyphenated option names for `build` command were effectively ignored.

## v1.3.0 [06-30-2017]
- Added support for optional polymer-project-config provision of bundler options instead of only boolean value for the `bundle` property of build definitions.  See the [Polymer Project Config 3.4.0 release notes](https://github.com/Polymer/polymer-project-config/pull/37) for details on new options available in polymer.json.
- Includes Polymer Build fixes to push-manifest generation and others.  See [Polymer Build 1.6.0 release notes](https://github.com/Polymer/polymer-build/pull/249).
- Includes Polymer Bundler fixes to shell strategy and others.  See [Polymer Bundler 2.2.0 release notes](https://github.com/Polymer/polymer-bundler/pull/573).

## v1.2.0 [06-12-2017]
- Updated lint rule to `polymer-2` in the `polymer-2-element` template.
- Drop 1.x init templates. Bump `shop` init template to latest version.

## v1.1.0 [05-23-2017]
- Updated dependency on latest polymer-project-config so that bundled presets include prefetch link generation.
- `build` Entrypoints will now be properly cached by generated service workers, and assets will be fetched by service workers using relative URLs to support apps mounted at non-root host paths.
- `build` The `basePath` option no longer adds a prefix to service workers or push manifests. Relative URLs are used instead.

## v1.0.2 [05-19-2017]
- Updates dependencies on latest polymer-build and polymer-bundler to reduce extraneous html tag output when bundling and generating prefetch links.

## v1.0.1 [05-18-2017]
- Update element and application templates to latest stable versions
- Prefetch links are now compatible with bundler and differential serving w/ base tag hrefs in entrypoint documents.

## v1.0.0 [05-16-2017]
- Official 1.0.0 release of the Polymer CLI! 🎉
- `build` Support for new `basePath` build config option that remaps paths to assist in serving at non-root paths, such as when doing differential serving of multiple builds from the same host. Affects service worker generation, push manifest generation, and also updates the entrypoint's `<base>` tag if found.
- `build` Building your project will now write a copy of your `polymer.json` to the build directory. This provides a log of the build options used at the time, including expansion of presets.

## v0.18.4 [05-15-2017]
- Updated dependencies to support official `polymer-analyzer` 2.0.0 and `web-components-tester` 6.0.0 releases.

## v0.18.3 [05-12-2017]
- Fix the CLI preset flag.
- Fix an issue where compiling JS would crash in versions of node with native async iterators.
- `bundle` no longer emits any JS or CSS files which have been inlined into bundles.

## v0.18.2 [05-10-2017]

- `build` Support build configuration "presets".
- `build` Performance improvements, including reduction of extraneous insertions of html, head and body tags.
- `bundle` has many bug fixes and support for lazy imports.
- Update polyserve to 0.19.0 which adds HTTP compression and JS compilation for Mobile Safari and Vivaldi browsers.
- Produce much smaller output when compiling many JS files to ES5 by inserting babel helpers only once, at the toplevel entrypoint.

- `init`: Propagate `description` from `init` to application templates in `index.html` meta tag.

- **New Command Aliases**: Commands now support aliases. `polymer install` has been aliased under `polymer i`.

## v0.18.1 [04-25-2017]

- `init` small template fixes.
- `serve` now respects the `entrypoint` configured in `polymer.json`.
- Remove ability to run a locally installed version of the CLI if it exists in the current working directory. This unexpected behavior was never documented but some users could be running an incorrect version of the CLI as a result.
- Update Node.js version pre-run check to match latest supported versions.

## v0.18.0 [04-13-2017]

v0.18.0 contains our latest work to support both Polymer 1.x & 2.0 projects. There are a bunch of big new features included in this update, as well as several breaking changes since the latest version. Here is a quick summary of the major changes for anyone who is updating from our previous `latest`/`v0.17.0` version:

- **New Polymer 2.0 Templates**: `polymer init` has added new Polymer 2.0 templates for starter elements, applications, and our latest Polymer Starter Kit & Shop applications. Run `polymer init` to see the whole list.
- **Updated `lint` Command**: `polymer lint` is now powered by our newest version of [polymer-linter](https://github.com/Polymer/polymer-linter). The new linter can show you the exact location of any problems in your code, and is much more configurable. Run `polymer help lint` for more information.
- **Updated `build` Command**: `polymer build` is now powered by our newest version of [polymer-build](https://github.com/Polymer/polymer-linter), which provides even more optimizations and features for customizing your build. Run `polymer help build` for more information.
- **New Build Output**: The biggest change to `polymer build` behavior is that it no longer defaults to outputting two, optimized build targets. The new default behavior is to generate a single `/build/default` directory with all configurable optimizations turned off by default. To customize your build(s) and include different optimizations, you can either include CLI flags (like `--js-compile`) or custom polymer.json build configurations. See the latest [polymer.json "builds"](https://www.polymer-project.org/2.0/docs/tools/polymer-json#builds) specification for more information.
- **New `analyze` Command:** Generates a JSON blob of metadata about your element(s). This can be useful to have for tooling and analysis.
- **New `install` Command:** Like `bower install`, but with support for installing "variants" as defined in your `bower.json`. See [the glossary](https://www.polymer-project.org/2.0/docs/glossary#dependency-variants) for more information.
- Remove Node v4 support: Node v4 is no longer in Active LTS, so as per the [Polymer Tools Node.js Support Policy](https://www.polymer-project.org/2.0/docs/tools/node-support) the Polymer CLI will not support Node v4 going forward. Please update to Node v6 or later to continue using the latest verisons of Polymer tooling.

<details>
  <summary><strong>See the Full v0.18.0 Pre-Release Changelog</strong></summary><p>

#### v0.18.0 [04-13-2017]

- `build`: Add `--add-push-manifest`/`addPushManifest` option for generating a [`push-manifest.json`](https://github.com/GoogleChrome/http2-push-manifest) file for your project.
- `build`: Fix a bug where `--insert-prefetch-links` would generate 404ing imports.
- `build`: Update automatic `webcomponentsjs` polyfilling to move it and all affected elements following it into the body so that the `custom-elements-es5-adapter.js` can work properly in IE11. (See [#627](https://github.com/Polymer/polymer-cli/issues/627))
- `init`: Init template elements now properly inherit from the given element/app name.
- `init`: Fix `polymer-2-element` template serving by removing iron-component-page until it can support Polymer 2.0 class-based elements.
- `init`: Update polymer 2.0 application & element tests to improve and fix broken tests.
- `init`: Update polymer 1.x application & element template WCT dependency to `^6.0.0-prerelease.5`.
- `init`: Update polymer application & element READMEs.
- `serve`: Update to polyserve@v0.17.0 to support autocompilation when serving to Chromium, Edge browsers.
- [Breaking] Remove Node v4 support: Node v4 is no longer in Active LTS, so as per the [Polymer Tools Node.js Support Policy](https://www.polymer-project.org/2.0/docs/tools/node-support) the Polymer CLI will not support Node v4. Please update to Node v6 or later to continue using the latest verisons of Polymer tooling.

#### v0.18.0-pre.15 [03-22-2017]

- `build`: Update automatic `webcomponentsjs` polyfilling to use `custom-elements-es5-adapter.js` instead of broken `webcomponents-es5-loader.js`. Fixes compiled, bundled builds in Chrome. (See [#605](https://github.com/Polymer/polymer-cli/issues/605))

#### v0.18.0-pre.14 [03-20-2017]

- The experimental linter has graduated to be the new default. Removed `polymer experimental-lint` command. `polymer lint` now runs [polymer-linter](https://github.com/Polymer/polymer-linter). See the README and `polymer lint --help` for more info.

#### v0.18.0-pre.13 [03-08-2017]

- When running `polymer build` and compiling JS to ES5, we will also rewrite script includes of `webcomponents-loader.js` to `webcomponents-es5-loader.js`.

#### v0.18.0-pre.12 [03-07-2017]

- Add PSK 3.0 (Polymer 2.0 Polymer Starter Kit) template to the init command.
- Automatically include un-optimized `webcomponentsjs` polyfills in builds.
- Update Polymer Analyzer, Polymer Bundler and Polymer Linter dependencies
  - Bundles now include optimizations specified in builds.
  - Much more detailed output of `analyze` command.

#### v0.18.0-pre.10 [02-21-2017]

- **New `build` Behavior**: New build options have been added to give you more control over the generated build. These options can be defined in your project's `polymer.json`, or via CLI flags. Run `polymer build --help` to see a list of new supported CLI flags.
  - **Previously default behaviors (minifying JavaScript, generating service workers, etc) are now turned off by default.**
  - Multiple builds can now be defined in your project's `polymer.json`. See [the latest documentation](https://github.com/Polymer/docs/blob/ff74953fa93ad41d659a6f5a14c5f7072368edbd/app/2.0/docs/tools/polymer-json.md#builds) for information on configuring your project build(s).
- `init`: Add new 2.0 polymer element & application templates.
- Update dependencies.
- **New `experimental-lint` command**: configurable with per-project rulesets, either with cli args or in your polymer.json. Will soon replace the `lint` command, for now run it as `polymer experimental-lint`. Specify "polymer-2", "polymer-2-hybrid", or "polymer-1" to customize the lint warnings that you receive. Run `polymer help experimental-lint` for more detail.

#### v0.18.0-alpha.9

- Fixed a bug where `polymer init` would crash if run from a folder with a
  package.json that's missing a name property. https://github.com/Polymer/polymer-cli/issues/186
- Fixed a bug where `polymer build` wouldn't analyze behaviors correctly.
- Fixed a bug where `polymer test` would complain about the version of wct it was bundled with.
- Updated dependencies.

#### v0.18.0-alpha.8

- Updated dependencies.

#### v0.18.0-alpha.7

- **Added `analyze` command:** Generates a JSON blob of metadata about your element(s). Useful for tooling and analysis.
- **Added `install` command:** Installs "variants" defined in your `bower.json`.
- Upgrade `polyserve` to `v0.6.0-prerelease.6` to handle serving variants
- Upgrade `web-component-tester` to `6.0.0-prerelease.1` to handle testing variants
- Upgrade `polymer-build` to `v0.6.0-alpha.1`, which includes an upgrade to the new [`polymer-analyzer`](https://github.com/Polymer/polymer-analyzer).
- `build`: Rename the `--include-dependencies` flag to `--extra-dependencies`
- `build`: css is now minified
- `build`: Lots of bug fixes due to the new polymer-build library and analyzer.
- `polymer.json`: Rename the `includeDependencies` & `sourceGlobs` fields to `extraDependencies` & `sources`, respectively
- Added support for v7.x of Node.js, dropped support for v5.x. Please move to an [actively maintained version of Node.js](https://github.com/nodejs/LTS) for the best experience.
- Upgrade [web-component-tester 6.0](https://github.com/Polymer/web-component-tester/blob/master/CHANGELOG.md) which brings a number of breaking changes to the `test` command.
- `init`: Fix duplicate names for sub-generators in a directory

</p></details>

## v0.17.0

- Upgrade `web-component-tester` to `v5.0.0`, which includes a new major version of mocha. See [the wct changelog](https://github.com/Polymer/web-component-tester/blob/v5.0.0/CHANGELOG.md#500) for more details.
- Upgrade `polyserve` to `v0.13.0`. See [the polyserve changelog](https://github.com/PolymerLabs/polyserve/blob/master/CHANGELOG.md) for more details.
- `build`: Add support for relative root path in polymer.json
- `build`: clear the build directory before building (#332)
- `init`: Fix issue where the application element name always used the current working directory name by default
- `init`: Fix undefined template description
- Fix issue with command failures exiting as successes (#418)

## v0.16.0

- build: fail immediately if polymer.json is invalid
- build: Add missing support for `sourceGlobs` & `includeDependencies` in polymer.json
- polymer-build@v0.4.1 (fixes ignored `staticFileGlobs` bug)


## v0.15.0

- replace app-drawer-template with starter-kit


## v0.14.0

- replace unneccesary gulp dependency with vinyl-fs
- polymer-build@v0.4.0 fixes build path issues
- but wait... THERE'S MORE! polymer-build@v0.4.0 also handles external resources properly now
- fix bug where `--version` flag threw an exception


## v0.13.0

- Refactor build logic out into standalone library: https://github.com/Polymer/polymer-build. Build behavior should remain the same from v0.12.0, but lots of work has been done in the new library to fix bugs and reduce build time/size.
- Refactor build file optimization streams
- Send an error code on polymer command run error


## v0.12.0

- gulp-typings@2.0.0
- github@1.1.0
- Update command-line-* suite of dependency, refactor to accomodate
- Refactor init command to be more easily testable, reduce startup times
- Catch exception thrown by findup when finding gulpfiles
- Add input linting argument, and fix major bug with paths
- init: Don’t crash when a package.json is present with no name
- Speed up start time, move last of the commands to load their dependencies at runtime
- Add demo and description for element template (#229)
- specify the sync interface when searching templates for package.json
- Removes unneccesary liftoff dependency
- Add update-notify to notify users when their cli is out of date
- Add tests for init command
