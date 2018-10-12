/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import * as bower from 'bower';
import {read as readBowerJson} from 'bower-json';
import * as child_process from 'child_process';
import * as path from 'path';
import * as logging from 'plylog';

import defaultBowerConfig = require('bower/lib/config');
import BowerLogger = require('bower-logger');
import StandardRenderer = require('bower/lib/renderers/StandardRenderer');
import BowerProject = require('bower/lib/core/Project');

const logger = logging.getLogger('cli.install');

async function exec(command: string, opts: child_process.ExecOptions) {
  return new Promise<[string, string]>((resolve, reject) => {
    child_process.exec(command, opts, (err, stdout, stderr) => {
      err ? reject(err) : resolve([stdout, stderr]);
    });
  });
}

type JsonValue = string|number|boolean|null|JsonObject|JsonArray;

interface JsonObject {
  [key: string]: JsonValue;
}

interface JsonArray extends Array<JsonValue> {}

export interface Options {
  variants?: boolean;
  offline?: boolean;
  npm?: boolean;
}

export async function install(options?: Options): Promise<void> {
  if (options && options.npm) {
    return npmInstall();
  }

  // default to false
  const offline = options == null ? false : options.offline === true;
  // default to false
  const variants = options == null ? false : options.variants === true;

  await Promise.all([
    bowerInstallDefault(offline),
    variants ? bowerInstallVariants(offline) : Promise.resolve(),
  ]);
}

async function npmInstall() {
  logger.info('Installing npm dependencies...');
  await exec('npm install', {cwd: process.cwd()});
  logger.info('Finished installing npm dependencies.');
}

interface ExtendedBowerProject extends BowerProject {
  _json?: JsonObject;
  _jsonFile?: string;
}

/**
 * Performs a Bower install, optionally with a specific JSON configuration and
 * output directory.
 */
async function _bowerInstall(
    offline: boolean,
    bowerJson?: JsonObject,
    componentDirectory?: string,
    variantName?: string): Promise<void> {
  const config = defaultBowerConfig({
    save: false,
    directory: componentDirectory,
    offline,
  });

  const bowerLogger = new BowerLogger();
  const cwd: string = config.cwd || process.cwd();
  const renderer = new StandardRenderer('install', {
    cwd,
    color: true,
  });
  bowerLogger.on('log', (log: bower.LogData) => renderer.log(log));
  bowerLogger.on('end', (data: {}) => renderer.end(data));
  bowerLogger.on('error', (err: Error) => renderer.error(err));

  const project: ExtendedBowerProject = new BowerProject(config, bowerLogger);

  // This is the only way I could find to provide a JSON object to the
  // Project. It's a hack, and might break in the future, but it works.
  if (bowerJson) {
    project._json = bowerJson;
    // Generate a new fake bower.json name because Bower is insting on
    // overwriting this file, even with the {save: false}.
    // TODO(justinfagnani): Figure this out
    const fileName = variantName ? `bower-${variantName}.json` : `bower.json`;
    project._jsonFile = path.join(cwd, fileName);
  }

  await project.install([], {save: false, offline}, config);
}

async function bowerInstallDefault(offline: boolean): Promise<void> {
  logger.info(`Installing default Bower components...`);
  await _bowerInstall(offline);
  logger.info(`Finished installing default Bower components`);
}

async function bowerInstallVariants(offline: boolean): Promise<void> {
  const bowerJson = await new Promise<JsonObject>((resolve, reject) => {
    const config = defaultBowerConfig({
      save: false,
    });
    const cwd = config.cwd || process.cwd();
    readBowerJson(cwd, {}, (err: {}, json: {}) => {
      err ? reject(err) : resolve(json);
    });
  });

  // Variants are patches ontop of the default bower.json, typically used to
  // override dependencies to specific versions for testing. Variants are
  // installed into folders named "bower_components-{variantName}", which
  // are
  // used by other tools like polyserve.
  const variants = bowerJson['variants'];
  if (variants) {
    await Promise.all(Object.keys(variants).map(async (variantName) => {
      const variant = (variants as JsonObject)[variantName];
      const variantBowerJson = _mergeJson(variant, bowerJson) as JsonObject;
      const variantDirectory = `bower_components-${variantName}`;
      logger.info(
          `Installing variant ${variantName} to ${variantDirectory}...`);
      await _bowerInstall(
          offline, variantBowerJson, variantDirectory, variantName);
      logger.info(`Finished installing variant ${variantName}`);
    }));
  }
}

/**
 * Exported only for testing
 */
export function _mergeJson(from: JsonValue, to: JsonValue): JsonValue {
  if (isPrimitiveOrArray(from) || isPrimitiveOrArray(to)) {
    return from;
  }
  const toObject = to as JsonObject;
  const fromObject = from as JsonObject;
  // First, make a shallow copy of `to` target
  const merged = Object.assign({}, toObject);

  // Next, merge in properties from `from`
  for (const key in fromObject) {
    // TODO(justinfagnani): If needed, we can add modifiers to the key
    // names in `from` to control merging:
    //   * "key=" would always overwrite, not merge, the property
    //   * "key|" could force a union (merge), even for Arrays
    //   * "key&" could perform an intersection
    merged[key] = _mergeJson(fromObject[key], toObject[key]);
  }
  return merged;
}

function isPrimitiveOrArray(value: {}|null|undefined) {
  if (value == null) {
    return true;
  }
  if (Array.isArray(value)) {
    return true;
  }
  const type = typeof value;
  return type === 'string' || type === 'number' || type === 'boolean';
}
