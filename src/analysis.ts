/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import * as fs from 'fs';
import * as jsonschema from 'jsonschema';
import * as path from 'path';

import {DocumentDescriptor} from './ast/ast';
import {Elements} from './elements-format';

const validator = new jsonschema.Validator();
const schema = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'analysis.schema.json'), 'utf-8'));

export class ValidationError extends Error {
  errors: jsonschema.ValidationError[];
  constructor(result: jsonschema.ValidationResult) {
    const message = `Unable to validate serialized Polymer analysis. ` +
        `Got ${result.errors.length} errors: ` +
        `${result.errors.map(err => '    ' + (err.message || err)).join('\n')}`;
    super(message);
    this.errors = result.errors;
  }
}


export class Analysis {
  descriptors: DocumentDescriptor[];

  constructor(descriptors: DocumentDescriptor[]) {
    this.descriptors = descriptors;
  }

  /**
   * Throws if the given object isn't a valid AnalyzedPackage according to
   * the JSON schema.
   */
  static validate(analyzedPackage: Elements|null|undefined) {
    const result = validator.validate(analyzedPackage, schema);
    if (result.throwError) {
      throw result.throwError;
    }
    if (result.errors.length > 0) {
      throw new ValidationError(result);
    }
    if (!/^1\.\d+\.\d+$/.test(analyzedPackage!.schema_version)) {
      throw new Error(
          `Invalid schema_version in AnalyzedPackage. ` +
          `Expected 1.x.x, got ${analyzedPackage!.schema_version}`);
    }
  }
}
