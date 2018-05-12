/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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
import * as chai from 'chai';
import * as path from 'path';

import * as config from '../../runner/config';
import {Context} from '../../runner/context';

const expect = chai.expect;

describe('config', () => {
  describe('.merge', () => {
    it('avoids modifying the input', () => {
      const one = {foo: 1} as any;
      const two = {foo: 2} as any;
      const merged = config.merge(one, two) as any;

      expect(one.foo).to.eq(1);
      expect(two.foo).to.eq(2);
      expect(merged.foo).to.eq(2);
      expect(merged).to.not.equal(two);
    });

    it('honors false as an explicit blacklisting', () => {
      const merged = config.merge(
          {plugins: {foo: {}}} as any, {plugins: {foo: false}} as any,
          {plugins: {foo: {}, bar: {}}} as any);

      expect(merged).to.deep.equal({plugins: {foo: false, bar: {}}});
    });
  });

  describe('.expand', () => {
    describe('deprecated options', () => {
      it('expands local string browsers', () => {
        const context = new Context({browsers: ['chrome']} as any);
        return config.expand(context).then(() => {
          expect(context.options.plugins['local'].browsers).to.have.members([
            'chrome'
          ]);
        });
      });

      it('expands sauce string browsers', () => {
        const context = new Context({browsers: ['linux/firefox']} as any);
        return config.expand(context).then(() => {
          expect(context.options.plugins['sauce'].browsers).to.have.members([
            'linux/firefox'
          ]);
        });
      });

      it('expands local object browsers', () => {
        const context =
            new Context({browsers: [{browserName: 'firefox'}]} as any);
        return config.expand(context).then(() => {
          expect(context.options.plugins['local'].browsers)
              .to.deep['have']
              .members([{browserName: 'firefox'}]);
        });
      });

      it('expands sauce object browsers', () => {
        const context = new Context(
            {browsers: [{browserName: 'safari', platform: 'OS X'}]} as any);
        return config.expand(context).then(() => {
          expect(context.options.plugins['sauce'].browsers)
              .to.deep['have']
              .members([{browserName: 'safari', platform: 'OS X'}]);
        });
      });
    });
  });

  describe('npm pathing', () => {
    describe('Resolves simple names to paths', () => {
      const localPackagePath =
          path.join(__dirname, '../fixtures/fake-packages/singleton-dep');
      const options = {root: localPackagePath} as config.Config;
      const npmPackages: config.NPMPackage[] = [
        {name: 'dependency', jsEntrypoint: 'index.js'},
        {name: 'dependency', jsEntrypoint: 'arbitraryJsFile.js'}
      ];
      const resolvedEntrypoints =
          config.resolveWctNpmEntrypointNames(options, npmPackages);

      expect(resolvedEntrypoints[0]).to.equal('dependency/index.js');
      expect(resolvedEntrypoints[1]).to.equal('dependency/arbitraryJsFile.js');
    });

    it('Resolves duplicated names to paths', () => {
      const localPackagePath =
          path.join(__dirname, '../fixtures/fake-packages/duplicated-dep');
      const options = {root: localPackagePath} as config.Config;
      const npmPackages: config.NPMPackage[] = [
        {name: 'dependency', jsEntrypoint: 'index.js'},
        {name: 'dependency', jsEntrypoint: 'arbitraryJsFile.js'}
      ];
      const resolvedEntrypoints =
          config.resolveWctNpmEntrypointNames(options, npmPackages);

      expect(resolvedEntrypoints[0])
          .to.equal('wct-browser-legacy/node_modules/dependency/index.js');
      expect(resolvedEntrypoints[1])
          .to.equal(
              'wct-browser-legacy/node_modules/dependency/arbitraryJsFile.js');
    });
  });
});
