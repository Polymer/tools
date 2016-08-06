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
import * as util from 'util';

import {Descriptor, DocumentDescriptor, ElementDescriptor, ImportDescriptor, InlineDocumentDescriptor, PropertyDescriptor} from './ast/ast';
import {Elements} from './elements-format';
import {JsonDocument} from './json/json-document';
import {trimLeft} from './utils';

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
  private _descriptors: DocumentDescriptor[];
  private _elementsByTagName = new Map<string, ElementDescriptor>();
  private _elementsByPackageDir = new Map<string, ElementDescriptor[]>();
  elementPaths = new Map<ElementDescriptor, string>();

  constructor(descriptors: DocumentDescriptor[]) {
    this._descriptors = descriptors;
    const packageGatherer = new PackageGatherer();
    const elementsGatherer = new ElementGatherer();
    new AnalysisWalker(this._descriptors).walk([
      packageGatherer, elementsGatherer
    ]);

    const elements = elementsGatherer.elementDescriptors;

    for (const element of elements) {
      if (element.is) {
        this._elementsByTagName.set(element.is);
      }
      let elementPath = elementsGatherer.elementPaths.get(element);
      const matchingPackageDirs =
          Array.from(packageGatherer.packageDirs)
              .filter(dir => trimLeft(elementPath, '/').startsWith(dir));
      const longestMatchingPackageDir =
          matchingPackageDirs.sort((a, b) => b.length - a.length)[0] || '';

      const elementsInPackage =
          this._elementsByPackageDir.get(longestMatchingPackageDir) || [];
      elementsInPackage.push(element);
      this._elementsByPackageDir.set(
          longestMatchingPackageDir, elementsInPackage);
      // We want element paths to be relative to the package directory.
      elementsGatherer.elementPaths.set(
          element, trimLeft(
                       trimLeft(elementPath, '/')
                           .substring(longestMatchingPackageDir.length),
                       '/'));
    }
    this.elementPaths = elementsGatherer.elementPaths;
  }

  getElement(tagName: string): ElementDescriptor|undefined {
    return this._elementsByTagName.get(tagName);
  }

  getElementsForPackage(dirName: string): ElementDescriptor[]|undefined {
    return this._elementsByPackageDir.get(dirName);
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


class PackageGatherer implements AnalysisVisitor {
  packageDirs = new Set<string>();
  visitDocumentDescriptor(dd: DocumentDescriptor): void {
    if (dd.document instanceof JsonDocument &&
        (dd.document.url.endsWith('package.json') ||
         dd.document.url.endsWith('bower.json'))) {
      const dirname = path.dirname(dd.document.url);
      if (!this.packageDirs.has(dirname)) {
        this.packageDirs.add(trimLeft(dirname, '/'));
      }
    }
  }
}

class ElementGatherer implements AnalysisVisitor {
  elementDescriptors: ElementDescriptor[] = [];
  elementPaths = new Map<ElementDescriptor, string>();
  visitElement(elementDescriptor: ElementDescriptor, path: Descriptor[]): void {
    let pathToElement: string|null = null;
    for (const descriptor of path) {
      if (descriptor instanceof DocumentDescriptor) {
        pathToElement = descriptor.document.url;
      }
    }
    if (!pathToElement) {
      throw new Error(
          `Unable to determine path to element: ${elementDescriptor}`);
    }
    if (this.elementPaths.has(elementDescriptor)) {
      if (this.elementPaths.get(elementDescriptor) !== pathToElement) {
        throw new Error(
            `Found element ${elementDescriptor} at distinct paths: ` +
            `${pathToElement} and ${this.elementPaths.get(elementDescriptor)}`);
      }
      return;
    }

    this.elementPaths.set(elementDescriptor, pathToElement);
    this.elementDescriptors.push(elementDescriptor);
  }
}

abstract class AnalysisVisitor {
  visitDocumentDescriptor?(dd: DocumentDescriptor, path: Descriptor[]): void;
  visitInlineDocumentDescriptor?
      (dd: InlineDocumentDescriptor<any>, path: Descriptor[]): void;
  visitElement?(element: ElementDescriptor, path: Descriptor[]): void;
  visitImportDescriptor?
      (importDesc: ImportDescriptor<any>, path: Descriptor[]): void;
  done?(): void;
}

class AnalysisWalker {
  private _documents: DocumentDescriptor[];
  private _path: Descriptor[] = [];
  constructor(descriptors: DocumentDescriptor[]) {
    this._documents = descriptors;
  }
  walk(visitors: AnalysisVisitor[]) {
    this._path.length = 0;
    for (const descriptor of this._documents) {
      this._walkDocumentDescriptor(descriptor, visitors);
    }
    for (const visitor of visitors) {
      if (visitor.done) {
        visitor.done();
      }
    }
  }

  private _walkDocumentDescriptor(
      dd: DocumentDescriptor, visitors: AnalysisVisitor[]) {
    this._path.push(dd);

    for (const visitor of visitors) {
      if (visitor.visitDocumentDescriptor) {
        visitor.visitDocumentDescriptor(dd, this._path);
      }
    }

    for (const entity of dd.entities) {
      this._walkEntity(entity, visitors);
    }
    for (const dependency of dd.dependencies) {
      this._walkEntity(dependency, visitors);
    }
    this._path.pop();
  }

  private _walkInlineDocumentDescriptor(
      dd: InlineDocumentDescriptor<any>, visitors: AnalysisVisitor[]) {
    for (const visitor of visitors) {
      if (visitor.visitInlineDocumentDescriptor) {
        visitor.visitInlineDocumentDescriptor(dd, this._path);
      }
    }
  }

  private _walkEntity(entity: Descriptor, visitors: AnalysisVisitor[]) {
    if (entity instanceof DocumentDescriptor) {
      return this._walkDocumentDescriptor(entity, visitors);
    } else if (entity instanceof InlineDocumentDescriptor) {
      return this._walkInlineDocumentDescriptor(entity, visitors);
    } else if (entity['type'] === 'element') {
      return this._walkElement(<ElementDescriptor>entity, visitors);
    } else if (entity instanceof ImportDescriptor) {
      return this._walkImportDescriptor(entity, visitors);
    }
    throw new Error(`Unknown kind of descriptor: ${util.inspect(entity)}`);
  }

  private _walkElement(
      element: ElementDescriptor, visitors: AnalysisVisitor[]) {
    for (const visitor of visitors) {
      if (visitor.visitElement) {
        visitor.visitElement(element, this._path);
      }
    }
  }

  private _walkImportDescriptor(
      importDesc: ImportDescriptor<any>, visitors: AnalysisVisitor[]) {
    for (const visitor of visitors) {
      if (visitor.visitImportDescriptor) {
        visitor.visitImportDescriptor(importDesc, this._path);
      }
    }
  }
}