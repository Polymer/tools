/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {UAParser} from 'ua-parser-js';

/**
 * A feature supported by a web browser.
 */
export type BrowserCapability =
    // ECMAScript 2015 (aka ES6).
    'es2015'|
    // HTTP/2 Server Push.
    'push'|
    // Service Worker API.
    'serviceworker'|
    // JavaScript modules.
    'modules';

// TODO: This should have type UAParser, but its typings are wrong so that
// class can't be referenced as a type. Fix the typings.
export type UserAgentPredicate = (ua: any) => boolean;

const chrome = {
  es2015: since(49),
  push: since(41),
  serviceworker: since(45),
  modules: since(61),
};

const browserPredicates: {
  [browser: string]: {[key in BrowserCapability]: UserAgentPredicate}
} = {
  'Chrome': chrome,
  'Chromium': chrome,
  'Chrome Headless': chrome,
  'OPR': {
    es2015: since(36),
    push: since(28),
    serviceworker: since(32),
    modules: since(48),
  },
  'Vivaldi': {
    es2015: since(1),
    push: since(1),
    serviceworker: since(1),
    modules: () => false,
  },
  'Mobile Safari': {
    es2015: since(10),
    push: since(9, 2),
    serviceworker: () => false,
    modules: since(10, 3),
  },
  'Safari': {
    es2015: since(10),
    push: (ua) => {
      return versionAtLeast([9], parseVersion(ua.getBrowser().version)) &&
          // HTTP/2 on desktop Safari requires macOS 10.11 according to
          // caniuse.com.
          versionAtLeast([10, 11], parseVersion(ua.getOS().version));
    },
    // https://webkit.org/status/#specification-service-workers
    serviceworker: () => false,
    modules: since(10, 1),
  },
  'Edge': {
    // Edge versions before 15.15063 may contain a JIT bug affecting ES6
    // constructors (https://github.com/Microsoft/ChakraCore/issues/1496).
    es2015: since(15, 15063),
    push: since(12),
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/status/serviceworker/
    serviceworker: () => false,
    modules: () => false,
  },
  'Firefox': {
    es2015: since(51),
    // Firefox bug - https://bugzilla.mozilla.org/show_bug.cgi?id=1409570
    push: () => false,
    serviceworker: since(44),
    modules: () => false,
  },
};

/**
 * Return the set of capabilities for a user agent string.
 */
export function browserCapabilities(userAgent: string): Set<BrowserCapability> {
  const ua = new UAParser(userAgent);
  const capabilities = new Set<BrowserCapability>();
  const predicates = browserPredicates[ua.getBrowser().name || ''] || {};
  for (const capability of Object.keys(predicates) as BrowserCapability[]) {
    if (predicates[capability](ua)) {
      capabilities.add(capability);
    }
  };
  return capabilities;
}

/**
 * Parse a "x.y.z" version string of any length into integer parts. Returns -1
 * for a part that doesn't parse.
 */
export function parseVersion(version: string): number[] {
  return version.split('.').map((part) => {
    const i = parseInt(part, 10);
    return isNaN(i) ? -1 : i;
  });
}

/**
 * Return whether `version` is at least as high as `atLeast`.
 */
export function versionAtLeast(atLeast: number[], version: number[]): boolean {
  for (let i = 0; i < atLeast.length; i++) {
    const r = atLeast[i];
    const v = version.length > i ? version[i] : 0;
    if (v > r) {
      return true;
    }
    if (v < r) {
      return false;
    }
  }
  return true;
}

/**
 * Make a predicate that checks if the browser version is at least this high.
 */
function since(...atLeast: number[]): UserAgentPredicate {
  return (ua) => versionAtLeast(atLeast, parseVersion(ua.getBrowser().version));
}
