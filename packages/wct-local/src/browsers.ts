/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
import * as launchpad from 'launchpad';
import * as wd from 'wd';
import * as promisify from 'promisify-node';

type LaunchpadToWebdriver = (browser: launchpad.Browser) => wd.Capabilities;
const LAUNCHPAD_TO_SELENIUM: {[browser: string]: LaunchpadToWebdriver} = {
  chrome:  chrome,
  canary:  chrome,
  firefox: firefox,
  aurora:  firefox,
  ie:      internetExplorer,
  // Until https://code.google.com/p/selenium/issues/detail?id=7933
  safari:  safari,
};

export function normalize(
      browsers: (string | {browserName: string})[]): string[] {
  return (browsers || []).map(function(browser) {
    if (typeof browser === 'string') {
      return browser;
    }
    return browser.browserName;
  });
}

/**
 * Expands an array of browser identifiers for locally installed browsers into
 * their webdriver capabilities objects.
 *
 * If `names` is empty, or contains `all`, all installed browsers will be used.
 */
export async function expand(names: string[]): Promise<wd.Capabilities[]> {
  if (names.indexOf('all') !== -1) {
    names = [];
  }

  const unsupported = difference(names, supported());
  if (unsupported.length > 0) {
    throw new Error(
        `The following browsers are unsupported: ${unsupported.join(', ')}. ` +
        `(All supported browsers: ${supported().join(', ')})`
    );
  }

  const installedByName = await detect();
  const installed = Object.keys(installedByName);
  // Opting to use everything?
  if (names.length === 0) {
    names = installed;
  }

  const missing = difference(names, installed);
  if (missing.length > 0) {
    throw new Error(
        `The following browsers were not found: ${missing.join(', ')}. ` +
        `(All installed browsers found: ${installed.join(', ')})`
    );
  }

  return names.map(function(n) { return installedByName[n]; });
}

/**
 * Detects any locally installed browsers that we support.
 *
 * Exported for testabilty in wct.
 */
export async function detect(): Promise<{[browser: string]: wd.Capabilities}> {
  const launcher = await promisify(launchpad.local)();
  const browsers = await promisify(launcher.browsers)();

  const results: {[browser: string]: wd.Capabilities} = {};
  for (const browser of browsers) {
    if (!LAUNCHPAD_TO_SELENIUM[browser.name]) continue;
    const converter = LAUNCHPAD_TO_SELENIUM[browser.name];
    results[browser.name] = converter(browser);
  }

  return results;
}

/**
 * Exported for testabilty in wct.
 *
 * @return A list of local browser names that are supported by
 *     the current environment.
 */
export function supported(): string[] {
  return Object.keys(launchpad.local.platform).filter(
      (key) => key in LAUNCHPAD_TO_SELENIUM);
}

// Launchpad -> Selenium

/**
 * @param browser A launchpad browser definition.
 * @return A selenium capabilities object.
 */
function chrome(browser: launchpad.Browser): wd.Capabilities {
  return {
    'browserName': 'chrome',
    'version':     browser.version.match(/\d+/)[0],
    'chromeOptions': {
      'binary': browser.binPath,
      'args': ['start-maximized']
    },
  };
}

/**
 * @param browser A launchpad browser definition.
 * @return A selenium capabilities object.
 */
function firefox(browser: launchpad.Browser): wd.Capabilities {
  return {
    'browserName':    'firefox',
    'version':        browser.version.match(/\d+/)[0],
    'firefox_binary': browser.binPath,
  };
}

/**
 * @param browser A launchpad browser definition.
 * @return A selenium capabilities object.
 */
function safari(browser: launchpad.Browser): wd.Capabilities {
  // SafariDriver doesn't appear to support custom binary paths. Does Safari?
  return {
    'browserName': 'safari',
    'version':     browser.version,
    // TODO(nevir): TEMPORARY. https://github.com/Polymer/web-component-tester/issues/51
    'safari.options': {
      'skipExtensionInstallation': true,
    },
  };
}

/**
 * @param browser A launchpad browser definition.
 * @return A selenium capabilities object.
 */
function internetExplorer(browser: launchpad.Browser): wd.Capabilities {
  return {
    'browserName': 'internet explorer',
    'version':     browser.version,
  };
}

/** Filter out all elements from toRemove from source. */
function difference<T>(source: T[], toRemove: T[]): T[] {
  return source.filter((value) => toRemove.indexOf(value) < 0);
}
