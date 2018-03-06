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
import * as path from 'path';

const TRAVIS_CONFIG = '.travis.yml';

// https://docs.travis-ci.com/user/languages/javascript-with-nodejs/
interface TravisConfig {
  before_script?: string|string[];
  install?: string|string[];
  script?: string|string[];
  cache?: string|Array<string|{directories: string[]}>;
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
  const inTravisPath = path.join(inDir, TRAVIS_CONFIG);
  const travisBlob = (await fse.readFile(inTravisPath)).toString();
  const travisConfig = safeLoad(travisBlob) as Partial<TravisConfig>;

  // use 'yarn' to install
  travisConfig.install = 'yarn';

  // cache yarn directories
  travisConfig.cache = 'yarn';

  // install polymer-cli
  travisConfig.before_script = 'npm install -g polymer-cli';

  // use `--npm` in `polymer test` commands
  travisConfig.script = [
    'polymer test --npm',
    '>-\nif [ "${TRAVIS_PULL_REQUEST}" = "false" ]; then polymer test --npm -s \'default\';\nfi'
  ];

  const outPath = path.join(outDir, TRAVIS_CONFIG);
  await fse.writeFile(outPath, safeDump(travisConfig));
}
