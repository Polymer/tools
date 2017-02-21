#!/usr/bin/env node

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

'use strict';

process.title = 'analyze';

require('source-map-support').install();

const {Analyzer} = require('../lib/analyzer');
const {generateElementMetadata} = require('../lib/generate-elements');
const {FSUrlLoader} = require('../lib/url-loader/fs-url-loader');
const {PackageUrlResolver} = require('../lib/url-loader/package-url-resolver');

const analyzer = new Analyzer({
  urlLoader: new FSUrlLoader(process.cwd()),
  urlResolver: new PackageUrlResolver(),
});

const metadataFeatures = new Set();
const isInTests = /(\b|\/|\\)(test)(\/|\\)/;

const inputs = process.argv.slice(2);

if (inputs.length === 0) {
  analyzer.analyzePackage()
      .then((_package) => {
        _package
            .getByKind('element', {
              externalPackages: false,
            })
            .forEach((e) => metadataFeatures.add(e));
        _package
            .getByKind('element-mixin', {
              externalPackages: false,
            })
            .forEach((m) => metadataFeatures.add(m));
        const nonTestFeatures =
            Array.from(metadataFeatures)
                .filter((e) => !isInTests.test(e.sourceRange.file));
        const metadata = generateElementMetadata(nonTestFeatures, '');
        console.log(metadata);
      })
      .catch((e) => {
        console.error('error from analyzePackage');
        console.error(e);
      });
} else {
  Promise
      .all(inputs.map((input) => {
        return analyzer.analyze(input).then((document) => {
          document
              .getByKind('element', {
                externalPackages: false,
              })
              .forEach((e) => metadataFeatures.add(e));
          document
              .getByKind('element-mixin', {
                externalPackages: false,
              })
              .forEach((e) => metadataFeatures.add(e));
        });
      }))
      .then(() => {
        const metadata =
            generateElementMetadata(Array.from(metadataFeatures), '');
        console.log(metadata);
      })
      .catch((e) => {
        console.error('error from analyze');
        console.error(e);
      });
}
