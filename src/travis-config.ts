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
import {safeDump, safeLoad} from 'js-yaml';
import {EOL} from 'os';
import * as path from 'path';

const travisConfigFile = '.travis.yml';

// https://docs.travis-ci.com/user/languages/javascript-with-nodejs/
interface TravisConfig {
  before_script?: string|string[];
  install?: string|string[];
  script?: string|string[];
  cache?: string|Array<string|{directories: string[]}|{[key: string]: boolean}>;
}

// modify travis scripts, credit to @stramel for the modifications to make
function addNPMFlag(scripts: string[]): string[] {
  return scripts.map((script) => {
    if (script.indexOf('polymer test') > -1) {
      if (script.indexOf('--npm') === -1) {
        script = script.replace('polymer test', 'polymer test --npm');
      }
      if (script.indexOf('--module-resolution') === -1) {
        script = script.replace(
            'polymer test', 'polymer test --module-resolution=node');
      }
    }
    if (script.indexOf('wct') > -1) {
      if (script.indexOf('--npm') === -1) {
        script = script.replace('wct', 'wct --npm');
      }
      if (script.indexOf('--module-resolution') === -1) {
        script = script.replace('wct', 'wct --module-resolution=node');
      }
    }
    return script;
  });
}

function removeBowerAndPolymerInstall(scripts: string[]): string[] {
  return scripts
      .map((script) => {
        if (script.match(/bower i(?:nstall)?/) ||
            script.indexOf('polymer install') > -1) {
          return '';
        }
        if (script.match(/npm i(?:install)?|yarn add/)) {
          return script.split(' ').filter((s) => s !== 'bower').join(' ');
        }
        return script;
      })
      .filter((s) => !!s);
}

function removeTypingsAndFormattingChecks(scripts: string[]): string[] {
  return scripts.filter((script) => {
    const isUpdateTypes = script.indexOf('npm run update-types') > -1;
    const isFormat = script.indexOf('npm run format') > -1;
    return !isUpdateTypes && !isFormat;
  });
}

function configToArray(yamlPart: string|string[]|undefined): string[] {
  if (!yamlPart) {
    return [];
  } else if (typeof yamlPart === 'string') {
    return [yamlPart];
  } else {
    return yamlPart;
  }
}

/**
 * Set travis config in an expected way.
 * If value has no items, delete the key.
 * If value has one item, set a single string.
 * If value has more than one item, set the whole value array.
 * @param travisConfig Travis config to modify
 * @param key Property of travisConfig
 * @param value Array to set values from
 */
function setConfig(
    travisConfig: TravisConfig, key: keyof TravisConfig, value: string[]) {
  switch (value.length) {
    case 0:
      delete travisConfig[key];
      break;
    case 1:
      travisConfig[key] = value[0];
      break;
    default:
      travisConfig[key] = value;
  }
}

/**
 * Modify a project's travis config to remove `bower` commands
 * and ensure the testing commands use the `--npm` flag.
 *
 * @param inDir Root path to search for travis config
 * @param outDir Root path of output travis config
 */
export async function transformTravisConfig(
    inDir: string, outDir: string): Promise<void> {
  const inTravisPath = path.join(inDir, travisConfigFile);

  // If no `travis.yml` file exists, do nothing.
  if (!await fse.pathExists(inTravisPath)) {
    return;
  }

  const travisBlob = await fse.readFile(inTravisPath, 'utf-8');
  const travisConfig = safeLoad(travisBlob) as Partial<TravisConfig>| undefined;

  // It's possible for a `travis.yml` to be empty, or otherwise not an object.
  // If this happens, do nothing.
  if (!travisConfig) {
    return;
  }

  let beforeScripts = configToArray(travisConfig.before_script);
  let testScripts = configToArray(travisConfig.script);
  let installScripts = configToArray(travisConfig.install);

  // remove use of `bower` and `polymer install`
  beforeScripts = removeBowerAndPolymerInstall(beforeScripts);
  testScripts = removeBowerAndPolymerInstall(testScripts);
  installScripts = removeBowerAndPolymerInstall(installScripts);

  // remove TS and formatting checks
  beforeScripts = removeTypingsAndFormattingChecks(beforeScripts);

  // use `--npm` in `polymer test` and `wct` commands
  testScripts = addNPMFlag(testScripts);

  setConfig(travisConfig, 'before_script', beforeScripts);
  setConfig(travisConfig, 'script', testScripts);
  setConfig(travisConfig, 'install', installScripts);

  const outPath = path.join(outDir, travisConfigFile);
  const travisBlobOut =
      safeDump(travisConfig, {lineWidth: -1}).split('\n').join(EOL) + EOL;
  await fse.writeFile(outPath, travisBlobOut);
}
