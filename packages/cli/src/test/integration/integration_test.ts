/*
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

import {assert} from 'chai';
import * as path from 'path';
import {run as runGenerator} from 'yeoman-test';
import {createApplicationGenerator} from '../../init/application/application';
import {runCommand} from './run-command';
import {createElementGenerator} from '../../init/element/element';
import {createGithubGenerator} from '../../init/github';
import * as puppeteer from 'puppeteer';
import {startServers} from 'polyserve';
import {ProjectConfig} from 'polymer-project-config';

// A zero privilege github token of a nonce account, used for quota.
const githubToken = '8d8622bf09bb1d85cb411b5e475a35e742a7ce35';

// TODO(https://github.com/Polymer/tools/issues/74): some tests time out on
//     windows.
const isWindows = process.platform === 'win32';
const skipOnWindows = isWindows ? test.skip : test;

async function gotoOrDie(
    page: puppeteer.Page, url: string, configurationName?: string) {
  const configurationMessage =
      configurationName ? ` with config ${configurationName}` : '';
  let error: string|undefined;
  const handler = (e: string) => error = error || e;
  // Grab the first page error, if any.
  page.on('pageerror', handler);
  await page.goto(url);
  if (error) {
    throw new Error(
        `Error loading ${url} in Chrome${configurationMessage}: ${error}`);
  }
  // For the moment we don't type check in-browser expressions.
  // tslint:disable-next-line: no-any
  type Window = any;
  for (let i = 0; i < 3; i++) {
    await page.waitFor(function(this: Window) {
      return new Promise((resolve) => {
        this.requestAnimationFrame(resolve);
      });
    });
  }
  if (error) {
    throw new Error(`Error during rAFs after loading ${url} in Chrome${
        configurationMessage}. Browser Error:\n${error}`);
  }
  page.removeListener('pageerror', handler);
}

suite('integration tests', function() {
  const binPath = path.join(__dirname, '../../../', 'bin', 'polymer.js');

  // Extend timeout limit to 90 seconds for slower systems
  this.timeout(120000);
  const disposables: Array<() => void | Promise<void>> = [];
  teardown(async () => {
    await Promise.all(disposables.map((d) => d()));
    disposables.length = 0;
  });

  suite('init templates', () => {
    skipOnWindows('test the Polymer 3.x element template', async () => {
      const dir =
          await runGenerator(createElementGenerator('polymer-3.x'))
              .withPrompts({name: 'my-element'})  // Mock the prompt answers
              .toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint'], {cwd: dir});
      await runCommand(binPath, ['test'], {cwd: dir});
    });

    skipOnWindows('test the Polymer 3.x application template', async () => {
      const dir = await runGenerator(createApplicationGenerator('polymer-3.x'))
                      .withPrompts({name: 'my-app'})  // Mock the prompt answers
                      .toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint'], {cwd: dir});
      await runCommand(binPath, ['test'], {cwd: dir});
      await runCommand(binPath, ['build'], {cwd: dir});
    });

    skipOnWindows('test the Polymer 1.x application template', async () => {
      const dir = await runGenerator(createApplicationGenerator('polymer-1.x'))
                      .withPrompts({name: 'my-app'})  // Mock the prompt answers
                      .toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint'], {cwd: dir});
      await runCommand(binPath, ['test'], {cwd: dir});
      await runCommand(binPath, ['build'], {cwd: dir});
    });

    skipOnWindows('test the Polymer 2.x application template', async () => {
      const dir = await runGenerator(createApplicationGenerator('polymer-2.x'))
                      .withPrompts({name: 'my-app'})  // Mock the prompt answers
                      .toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint'], {cwd: dir});
      await runCommand(binPath, ['test'], {cwd: dir});
      await runCommand(binPath, ['build'], {cwd: dir});
    });

    skipOnWindows('test the Polymer 2.x "element" template', async () => {
      const dir =
          await runGenerator(createElementGenerator('polymer-2.x'))
              .withPrompts({name: 'my-element'})  // Mock the prompt answers
              .toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint'], {cwd: dir});
      await runCommand(binPath, ['test'], {cwd: dir});
    });

    skipOnWindows('test the Polymer 1.x "element" template', async () => {
      const dir =
          await runGenerator(createElementGenerator('polymer-1.x'))
              .withPrompts({name: 'my-element'})  // Mock the prompt answers
              .toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint'], {cwd: dir});
      await runCommand(binPath, ['test'], {cwd: dir});
    });

    test('test the "shop" template', async () => {
      const ShopGenerator = createGithubGenerator({
        owner: 'Polymer',
        repo: 'shop',
        githubToken,
      });

      const dir = await runGenerator(ShopGenerator).toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      // See: https://github.com/Polymer/shop/pull/114
      // await runCommand(
      //   binPath, ['lint', '--rules=polymer-2-hybrid'],
      //   {cwd: dir})
      // await runCommand(binPath, ['test'], {cwd: dir})
      await runCommand(binPath, ['build'], {cwd: dir});
    });

    // Serves the given directory with polyserve, then opens a Chrome tab
    // and pokes around to test that the site is serving a working Shop.
    async function assertThatShopWorks(
        dirToServe: string, configurationName: string) {
      const startResult = await startServers({root: dirToServe});
      if (startResult.kind === 'MultipleServers') {
        for (const server of startResult.servers) {
          server.server.close();
        }
        throw new Error(`Unexpected startResult`);
      }
      disposables.push(() => {
        startResult.server.close();
      });
      const address = startResult.server.address();
      const baseUrl = `http://${address.address}:${address.port}`;
      const debugging = !!process.env['DEBUG_CLI_TESTS'];
      let browser;
      if (debugging) {
        browser = await puppeteer.launch({headless: false, slowMo: 250});
      } else {
        browser = await puppeteer.launch();
      }

      const page = await browser.newPage();
      disposables.push(() => page.close());

      // Evaluate an expression as a string in the browser.
      const evaluate = async (expression: string) => {
        try {
          return await page.evaluate(expression);
        } catch (e) {
          throw new Error(`Failed evaluating expression \`${
              expression} in the browser with build configuration ${
              configurationName}. Error: ${e}`);
        }
      };
      // Assert on an expression's result in the browser.
      const assertTrueInPage = async (expression: string) => {
        assert(
            await evaluate(expression),
            `Expected \`${
                expression}\` to evaluate to true in the browser with build configuration ${
                configurationName}`);
      };
      // For the moment we don't type check in-browser expressions.
      // tslint:disable-next-line: no-any
      type Window = any;
      const waitFor =
          async (name: string, cb: (this: Window) => boolean | Promise<{}>) => {
        try {
          await page.waitFor(cb);
        } catch (e) {
          throw new Error(`Error waiting for ${
              name} in the browser with build configuration ${
              configurationName}`);
        }
      };

      await gotoOrDie(page, `${baseUrl}/`, configurationName);
      assert.deepEqual(`${baseUrl}/`, page.url());
      await waitFor('shop-app to be defined', function() {
        return this.customElements.get('shop-app') !== undefined;
      });
      await waitFor('shop-app to have a shadowRoot', function() {
        return this.document.querySelector('shop-app').shadowRoot !== undefined;
      });
      // The cart shouldn't be registered yet, because we've only loaded the
      // main page.
      await assertTrueInPage(`customElements.get('shop-cart') === undefined`);
      // Click the shopping cart button.
      await evaluate(`
          (
            // shop 3.0
            document.querySelector('shop-app').shadowRoot
                .querySelector('a[href="/cart"]')
            ||
            // shop lit
            document.querySelector('shop-app').shadowRoot
                .querySelector('shop-cart-button').shadowRoot
                    .querySelector('a[href="/cart"]')
          ).click()`);
      // Url changes immediately
      assert.deepEqual(`${baseUrl}/cart`, page.url());
      // We'll lazy load the code for shop-cart. We'll know that it worked
      // when the element is registered. If this resolves, it loaded
      // successfully!
      await waitFor('shop-cart to be defined', function() {
        return this.customElements.get('shop-cart') !== undefined;
      });
    }

    test('test the 3.0 "shop" template', async function() {
      // Shop has a lot of build configurations, they take a long time.
      this.timeout(10 * 60 * 1000);
      const ShopGenerator = createGithubGenerator(
          {owner: 'Polymer', repo: 'shop', githubToken, branch: '3.0'});

      const dir = await runGenerator(ShopGenerator).toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await Promise.all([
        // Does not lint clean at the moment.
        // TODO: https://github.com/Polymer/tools/issues/274
        // runCommand(binPath, ['lint', '--rules=polymer-3'], {cwd: dir}),
        runCommand(binPath, ['build'], {cwd: dir}),
      ]);

      const config =
          ProjectConfig.loadConfigFromFile(path.join(dir, 'polymer.json'));
      if (config == null) {
        throw new Error('Failed to load shop\'s polymer.json');
      }

      // Ideally this would be multiple independent tests, but `polymer build`
      // takes a really long time, and we can also get a bit better performance
      // by running these browser tests in parallel.
      await Promise.all(config.builds.map((b) => {
        const name = b.name || 'default';
        return assertThatShopWorks(path.join(dir, 'build', name), name);
      }));
    });

    test('test the lit-element "shop" template', async function() {
      // Shop has a lot of build configurations, they take a long time.
      this.timeout(10 * 60 * 1000);
      const ShopGenerator = createGithubGenerator(
          {owner: 'Polymer', repo: 'shop', githubToken, branch: 'lit-element'});

      const dir = await runGenerator(ShopGenerator).toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await Promise.all([
        // Does not lint clean at the moment.
        // TODO: https://github.com/Polymer/tools/issues/274
        // runCommand(binPath, ['lint', '--rules=polymer-3'], {cwd: dir}),
        runCommand(binPath, ['build'], {cwd: dir}),
      ]);

      const config =
          ProjectConfig.loadConfigFromFile(path.join(dir, 'polymer.json'));
      if (config == null) {
        throw new Error('Failed to load shop\'s polymer.json');
      }
      const dirs = config.builds.map(
          (b) => path.join(dir, 'build', b.name || 'default'));
      // Ideally this would be multiple independent tests, but `polymer
      // build` takes a really long time, and we can also get a bit better
      // performance by running these browser tests in parallel.
      await Promise.all(dirs.map(async (builtShopDir) => {
        await assertThatShopWorks(builtShopDir, path.basename(builtShopDir));
      }));
    });

    // TODO(justinfagnani): consider removing these integration tests
    // or checking in the contents so that we're not subject to the
    // other repo changing
    test.skip('test the Polymer 1.x "starter-kit" template', async () => {
      const PSKGenerator = createGithubGenerator({
        owner: 'Polymer',
        repo: 'polymer-starter-kit',
        semverRange: '^2.0.0',
        githubToken,
      });

      const dir = await runGenerator(PSKGenerator).toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(
          binPath, ['lint', '--rules=polymer-2-hybrid'], {cwd: dir});
      // await runCommand(binPath, ['test'], {cwd: dir})
      await runCommand(binPath, ['build'], {cwd: dir});
    });

    // TODO(justinfagnani): consider removing these integration tests
    // or checking in the contents so that we're not subject to the
    // other repo changing
    test.skip('test the Polymer 2.x "starter-kit" template', async () => {
      const PSKGenerator = createGithubGenerator({
        owner: 'Polymer',
        repo: 'polymer-starter-kit',
        semverRange: '^3.0.0',
        githubToken,
      });

      const dir = await runGenerator(PSKGenerator).toPromise();
      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint', '--rules=polymer-2'], {cwd: dir});
      // await runCommand(binPath, ['test'], {cwd: dir}));
      await runCommand(binPath, ['build'], {cwd: dir});
    });
  });

  // TODO(justinfagnani): consider removing these integration tests
  // or checking in the contents so that we're not subject to the
  // other repo changing
  suite.skip('tools-sample-projects templates', () => {
    let tspDir: string;

    suiteSetup(async () => {
      const TSPGenerator = createGithubGenerator({
        owner: 'Polymer',
        repo: 'tools-sample-projects',
        githubToken,
      });

      tspDir = await runGenerator(TSPGenerator).toPromise();
    });

    test('test the "polymer-1-app" template', async () => {
      const dir = path.join(tspDir, 'polymer-1-app');

      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint'], {cwd: dir});
      // await runCommand(binPath, ['test'], {cwd: dir});
      await runCommand(binPath, ['build'], {cwd: dir});
    });

    test('test the "polymer-2-app" template', async () => {
      const dir = path.join(tspDir, 'polymer-2-app');

      await runCommand(binPath, ['install'], {cwd: dir});
      await runCommand(binPath, ['lint'], {cwd: dir});
      // await runCommand(binPath, ['test'], {cwd: dir})
      await runCommand(binPath, ['build'], {cwd: dir});
    });
  });
});
