/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */
import ChildRunner from './childrunner.js';
import * as util from './util.js';

export interface Config {
  /**
   * `.js` scripts to be loaded (synchronously) before WCT starts in earnest.
   *
   * Paths are relative to `scriptPrefix`.
   */
  environmentScripts: string[];
  environmentImports: string[];
  /** Absolute root for client scripts. Detected in `setup()` if not set. */
  root: null|string;
  /** By default, we wait for any web component frameworks to load. */
  waitForFrameworks: boolean;
  /**
   * Alternate callback for waiting for tests.
   * `this` for the callback will be the window currently running tests.
   */
  waitFor: null|Function;
  /** How many `.html` suites that can be concurrently loaded & run. */
  numConcurrentSuites: number;
  /** Whether `console.error` should be treated as a test failure. */
  trackConsoleError: boolean;
  /** Configuration passed to mocha.setup. */
  mochaOptions: MochaSetupOptions;
  /** Whether WCT should emit (extremely verbose) debugging log messages. */
  verbose: boolean;
}

/**
 * The global configuration state for WCT's browser client.
 */
export let _config: Config = {
  environmentScripts: [],
  environmentImports: [],
  root: null,
  waitForFrameworks: true,
  waitFor: null,
  numConcurrentSuites: 1,
  trackConsoleError: true,
  mochaOptions: {timeout: 10 * 1000},
  verbose: false,
};

/**
 * Merges initial `options` into WCT's global configuration.
 *
 * @param {Object} options The options to merge. See `browser/config.ts` for a
 *     reference.
 */
export function setup(options: Partial<Config>) {
  const childRunner = ChildRunner.current();
  if (childRunner) {
    deepMerge(_config, childRunner.parentScope.WCT._config);
    // But do not force the mocha UI
    delete _config.mochaOptions.ui;
  }

  if (options && typeof options === 'object') {
    deepMerge(_config, options);
  }

  if (!_config.root) {
    // Sibling dependencies.
    const wctMochaJsRoot = util.scriptPrefix('wct-mocha.js');
    const browserJsRoot = util.scriptPrefix('browser.js');
    const scriptName = wctMochaJsRoot ? 'wct-mocha.js' : 'browser.js';
    const root = wctMochaJsRoot || browserJsRoot;
    _config.root = util.basePath(root.substr(0, root.length - 1));
    if (!_config.root) {
      throw new Error(
          `Unable to detect root URL for WCT sources. ` +
          `Please set WCT.root before loading ${scriptName} first.`);
    }
  }
}

/**
 * Retrieves a configuration value.
 */
export function get<K extends keyof Config>(key: K): Config[K] {
  return _config[key];
}

export function deepMerge(target: Partial<Config>, source: Partial<Config>) {
  Object.keys(source).forEach((key) => {
    if (target[key] !== null && typeof target[key] === 'object' &&
        !Array.isArray(target[key])) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  });
}
