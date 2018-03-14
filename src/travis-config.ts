/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import * as fse from 'fs-extra';
import * as path from 'path';

import { safeDump, safeLoad } from 'js-yaml';

const travisConfigFile = '.travis.yml';

// https://docs.travis-ci.com/user/languages/javascript-with-nodejs/
interface TravisConfig {
  before_script?: string | string[];
  install?: string | string[];
  script?: string | string[];
  cache?: string | Array<string | { directories: string[] } | { [key: string]: boolean }>;
}

function addNPMFlag(scripts: string[]): string[] {
  return scripts.map((script) => {
    if (script.indexOf('polymer test') > -1 && script.indexOf('--npm') === -1) {
      script = script.replace('polymer test', 'polymer-test --npm');
    }
    if (script.indexOf('wct') > -1 && script.indexOf('--npm') === -1) {
      script = script.replace('wct', 'wct --npm');
    }
    return script;
  });
}

function removeBowerAndPolymerInstall(scripts: string[]): string[] {
  return scripts.map((script) => {
    if (script.match(/bower i(?:nstall)?/) || script.indexOf('polymer install') > -1) {
      return '';
    }
    if (script.match(/npm i(?:install)?|yarn add/)) {
      return script.split(' ').filter((s) => s !== 'bower').join(' ');
    }
    return script;
  }).filter((s) => !!s);
}

function configToArray(yamlPart: string | string[] | undefined): string[] {
  if (!yamlPart) {
    return [];
  } else if (typeof yamlPart === 'string') {
    return [yamlPart];
  } else {
    return yamlPart;
  }
}

/**
 * Modify a project's travis config to use `yarn`
 * and the polymer-cli commands with the `--npm` flag.
 *
 * @param inDir Root path to search for travis config
 * @param outDir Root path of output travis config
 */
export async function transformTravisConfig(
  inDir: string, outDir: string): Promise<void> {

  const inTravisPath = path.join(inDir, travisConfigFile);

  if (!await fse.pathExists(inTravisPath)) {
    return;
  }

  const travisBlob = (await fse.readFile(inTravisPath)).toString();
  const travisConfig = safeLoad(travisBlob) as Partial<TravisConfig>;

  let beforeScript = configToArray(travisConfig.before_script);
  let testScript = configToArray(travisConfig.script);
  let installScript = configToArray(travisConfig.install);

  // remove use of `bower` and `polymer install`
  beforeScript = removeBowerAndPolymerInstall(beforeScript);
  testScript = removeBowerAndPolymerInstall(testScript);
  installScript = removeBowerAndPolymerInstall(installScript);

  // use `--npm` in `polymer test` and `wct` commands
  testScript = addNPMFlag(testScript);

  travisConfig.before_script = beforeScript;
  travisConfig.script = testScript;
  // only add `install` config if previous config had one
  if (installScript.length > 0) {
    travisConfig.install = installScript;
  } else {
    delete travisConfig.install;
  }

  const outPath = path.join(outDir, travisConfigFile);
  const travisBlobOut = safeDump(travisConfig);
  await fse.writeFile(outPath, travisBlobOut);
}
