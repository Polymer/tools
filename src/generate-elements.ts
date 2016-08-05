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

import {Analysis} from './analysis';
import {Descriptor, DocumentDescriptor, ElementDescriptor, ImportDescriptor, InlineDocumentDescriptor, LocationOffset, PropertyDescriptor} from './ast/ast';
import {Attribute, Element, Elements, Event, Property, SourceLocation} from './elements-format';
import {JsonDocument} from './json/json-document';
import {Document} from './parser/document';
import {trimLeft} from './utils';


export function generateElementMetadata(
    analysis: Analysis, packagePath: string): Elements|undefined {
  const packageGatherer = new PackageGatherer();
  const elementsGatherer = new ElementGatherer();
  new AnalysisWalker(analysis.descriptors).walk([
    packageGatherer, elementsGatherer
  ]);

  const packagesByDir: Map<string, Elements> = packageGatherer.packagesByDir;
  const elements = elementsGatherer.elements;
  const elementsByPackageDir = new Map<string, Element[]>();

  for (const element of elementsGatherer.elements) {
    const matchingPackageDirs =
        <string[]>Array.from(packagesByDir.keys())
            .filter(dir => trimLeft(element.path, '/').startsWith(dir));
    const longestMatchingPackageDir =
        matchingPackageDirs.sort((a, b) => b.length - a.length)[0] || '';

    if (longestMatchingPackageDir === '' && !packagesByDir.has('')) {
      packagesByDir.set('', {schema_version: '1.0.0', elements: []});
    }
    packagesByDir.get(longestMatchingPackageDir)!.elements.push(element);
    // We want element paths to be relative to the package directory.
    element.path = trimLeft(
        trimLeft(element.path, '/').substring(longestMatchingPackageDir.length),
        '/');
  }

  return packagesByDir.get(packagePath);
}

function serializeElementDescriptor(
    elementDescriptor: ElementDescriptor, path: string,
    locationOffset?: LocationOffset): Element|null {
  const propChangeEvents: Event[] =
      (elementDescriptor.properties || [])
          .filter(p => p.notify && propertyToAttributeName(p.name))
          .map(p => ({
                 name: `${propertyToAttributeName(p.name)}-changed`,
                 type: 'CustomEvent',
                 description: `Fired when the \`${p.name}\` property changes.`
               }));

  if (!elementDescriptor.is) {
    return null;
  }
  const properties = elementDescriptor.properties || [];
  return {
    tagname: elementDescriptor.is,
    description: elementDescriptor.desc || '',
    superclass: 'HTMLElement',
    path: path,
    attributes:
        computeAttributesFromPropertyDescriptors(properties, locationOffset),
    properties:
        properties.map(p => serializePropertyDescriptor(p, locationOffset)),
    styling: {
      cssVariables: [],
      selectors: [],
    },
    demos: (elementDescriptor.demos || []).map(d => d.path),
    slots: [],
    events: propChangeEvents,
    metadata: {},
    sourceLocation:
        correctSourceLocation(elementDescriptor.sourceLocation, locationOffset)
  };
}

function serializePropertyDescriptor(
    propertyDescriptor: PropertyDescriptor,
    locationOffset?: LocationOffset): Property {
  const property: Property = {
    name: propertyDescriptor.name,
    type: propertyDescriptor.type || '?',
    description: propertyDescriptor.desc || '',
    sourceLocation:
        correctSourceLocation(propertyDescriptor.sourceLocation, locationOffset)
  };
  if (propertyDescriptor.default) {
    property.defaultValue = JSON.stringify(propertyDescriptor.default);
  }
  const polymerMetadata: any = {};
  const polymerMetadataFields = ['notify', 'observer', 'readOnly'];
  for (const field of polymerMetadataFields) {
    if (field in propertyDescriptor) {
      polymerMetadata[field] = propertyDescriptor[field];
    }
  }
  property.metadata = {polymer: polymerMetadata};
  return property;
}

function computeAttributesFromPropertyDescriptors(
    props: PropertyDescriptor[], locationOffset?: LocationOffset): Attribute[] {
  return props.filter(prop => propertyToAttributeName(prop.name)).map(prop => {
    const attribute: Attribute = {
      name: propertyToAttributeName(prop.name),
      description: prop.desc || '',
      sourceLocation: correctSourceLocation(prop.sourceLocation, locationOffset)
    };
    if (prop.type) {
      attribute.type = prop.type;
    }
    if (prop.default) {
      attribute.type = prop.type;
    }
    return attribute;
  });
}

class PackageGatherer implements AnalysisVisitor {
  private _packageFiles: string[] = [];
  packagesByDir = new Map<string, Elements>();
  visitDocumentDescriptor(dd: DocumentDescriptor, path: Descriptor[]): void {
    if (dd.document instanceof JsonDocument &&
        (dd.document.url.endsWith('package.json') ||
         dd.document.url.endsWith('bower.json'))) {
      this._packageFiles.push(dd.document.url);
    }
  }

  done() {
    for (const packageFile of this._packageFiles) {
      const dirname = path.dirname(packageFile);
      if (!this.packagesByDir.has(dirname)) {
        this.packagesByDir.set(
            trimLeft(dirname, '/'), {schema_version: '1.0.0', elements: []});
      }
    }
  }
}

class ElementGatherer implements AnalysisVisitor {
  elements: Element[] = [];
  private _elementPaths = new Map<ElementDescriptor, string>();
  visitElement(elementDescriptor: ElementDescriptor, path: Descriptor[]): void {
    let pathToElement: string|null = null;
    let locationOffset: LocationOffset;
    for (const descriptor of path) {
      if (descriptor instanceof DocumentDescriptor) {
        pathToElement = descriptor.document.url;
        locationOffset = descriptor.locationOffset;
      }
    }
    if (!pathToElement) {
      throw new Error(
          `Unable to determine path to element: ${elementDescriptor}`);
    }
    if (this._elementPaths.has(elementDescriptor)) {
      if (this._elementPaths.get(elementDescriptor) !== pathToElement) {
        throw new Error(
            `Found element ${elementDescriptor} at distinct paths: ` +
            `${pathToElement} and ${this._elementPaths.get(elementDescriptor)}`);
      }
    } else {
      this._elementPaths.set(elementDescriptor, pathToElement);
      const element = serializeElementDescriptor(
          elementDescriptor, pathToElement, locationOffset);
      if (element) {
        this.elements.push(element);
      }
    }
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


/**
 * Implements Polymer core's translation of property names to attribute names.
 *
 * Returns null if the property name cannot be so converted.
 */
function propertyToAttributeName(propertyName: string): string|null {
  // Polymer core will not map a property name that starts with an uppercase
  // character onto an attribute.
  if (propertyName[0].toUpperCase() === propertyName[0]) {
    return null;
  }
  return propertyName.replace(
      /([A-Z])/g, (_: string, c1: string) => `-${c1.toLowerCase()}`);
}

export function correctSourceLocation(
    sourceLocation: SourceLocation,
    locationOffset?: LocationOffset): SourceLocation|undefined {
  if (!locationOffset)
    return sourceLocation;
  return sourceLocation && {
    line: sourceLocation.line + locationOffset.line,
    // The location offset column only matters for the first line.
    column: sourceLocation.column +
        (sourceLocation.line === 0 ? locationOffset.col : 0)
  };
}
