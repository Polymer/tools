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
import {startServers, ServerOptions} from 'polyserve';
import {ProjectConfig, ProjectOptions} from 'polymer-project-config';
import * as tempMod from 'temp';
import * as fs from 'fs';

const temp = tempMod.track();

const disposables: Array<() => void | Promise<void>> = [];

// A zero privilege github token of a nonce account, used for quota.
const githubToken = '8d8622bf09bb1d85cb411b5e475a35e742a7ce35';

// TODO(https://github.com/Polymer/tools/issues/74): some tests time out on
//     windows.
const isWindows = process.platform === 'win32';
const skipOnWindows = isWindows ? test.skip : test;
const binPath = path.join(__dirname, '../../../', 'bin', 'polymer.js');

// Serves the given directory with polyserve, returns a fully qualified
// url of the server.
async function serve(dirToServe: string, options: ServerOptions = {}) {
  const startResult = await startServers({root: dirToServe, ...options});
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
  return `http://${address.address}:${address.port}`;
}

/**
 * Like puppeteer's page.goto(), except it fails if any uncaught exceptions are
 * thrown, and it waits a few rAFs after the load to be really sure the page is
 * ready.
 */
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
  // Extend timeout limit to 90 seconds for slower systems
  this.timeout(120000);

  suiteTeardown(async () => {
    await Promise.all(disposables.map((d) => d()));
    disposables.length = 0;
  });
  teardown(async () => {});

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
      const baseUrl = await serve(dirToServe);
      const debugging = !!process.env['DEBUG_CLI_TESTS'];
      let browser: puppeteer.Browser;
      if (debugging) {
        browser = await puppeteer.launch({headless: false, slowMo: 250});
      } else {
        browser = await puppeteer.launch();
      }
      const page = await browser.newPage();
      disposables.push(() => browser.close());

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

suite('import.meta support', async () => {
  let tempDir: string;
  // Build options, copied from shop.
  const options: ProjectOptions = {
    entrypoint: 'index.html',
    builds: [
      {
        name: 'esm-bundled',
        browserCapabilities: ['es2015', 'modules'],
        js: {minify: true},
        css: {minify: true},
        html: {minify: true},
        bundle: true
      },
      {
        name: 'es6-bundled',
        browserCapabilities: ['es2015'],
        js: {minify: true, transformModulesToAmd: true},
        css: {minify: true},
        html: {minify: true},
        bundle: true
      },
      {
        name: 'es5-bundled',
        js: {compile: true, minify: true, transformModulesToAmd: true},
        css: {minify: true},
        html: {minify: true},
        bundle: true
      }
    ],
    moduleResolution: 'node',
    npm: true
  };
  suiteSetup(function() {
    tempDir = temp.mkdirSync('-import-meta');

    // An inline import.meta test fixture!
    fs.writeFileSync(path.join(tempDir, 'index.html'), `
        <script type="module">
            import './subdir/foo.js';
            window.indexHtmlUrl = import.meta.url;
        </script>
      `);
    fs.mkdirSync(path.join(tempDir, 'subdir'));
    fs.writeFileSync(path.join(tempDir, 'subdir/index.html'), `
        <script type="module">
            import './foo.js';
            window.indexHtmlUrl = import.meta.url;
        </script>
      `);
    fs.writeFileSync(path.join(tempDir, 'subdir', 'foo.js'), `
        window.fooUrl = import.meta.url;
    `);
    fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({name: 'import-meta-test'}));
    fs.writeFileSync(
        path.join(tempDir, 'polymer.json'), JSON.stringify(options));
  });
  teardown(async () => {
    await Promise.all(disposables.map((d) => d()));
    disposables.length = 0;
  });

  // The given url should be a fully qualified
  const assertPageWorksCorrectly =
      async (baseUrl: string, skipTestingSubdir: boolean = false) => {
    const browser = await puppeteer.launch();
    disposables.push(() => browser.close());
    const page = await browser.newPage();
    await gotoOrDie(page, `${baseUrl}/`);
    assert.deepEqual(await page.evaluate(`window.indexHtmlUrl`), `${baseUrl}/`);
    assert.deepEqual(
        await page.evaluate('window.fooUrl'), `${baseUrl}/subdir/foo.js`);
    await gotoOrDie(page, `${baseUrl}/index.html`);
    assert.deepEqual(
        await page.evaluate(`window.indexHtmlUrl`), `${baseUrl}/index.html`);
    assert.deepEqual(
        await page.evaluate('window.fooUrl'), `${baseUrl}/subdir/foo.js`);
    if (!skipTestingSubdir) {
      await gotoOrDie(page, `${baseUrl}/subdir/`);
      assert.deepEqual(
          await page.evaluate(`window.indexHtmlUrl`), `${baseUrl}/subdir/`);
      assert.deepEqual(
          await page.evaluate('window.fooUrl'), `${baseUrl}/subdir/foo.js`);
      await gotoOrDie(page, `${baseUrl}/subdir/index.html`);
      assert.deepEqual(
          await page.evaluate(`window.indexHtmlUrl`),
          `${baseUrl}/subdir/index.html`);
      assert.deepEqual(
          await page.evaluate('window.fooUrl'), `${baseUrl}/subdir/foo.js`);
    }
    return page;
  };

  test('import.meta works uncompiled in chrome', async function() {
    const url = await serve(tempDir, {compile: 'never'});
    const page = await assertPageWorksCorrectly(url);
    await gotoOrDie(page, `${url}/`);
    assert.include(
        await page.content(),
        'import.meta',
        'expected import.meta to not be compiled out!');
  });

  let testName = 'import.meta works in chrome with polyserve es5 compilation';
  test(testName, async function() {
    const url = await serve(tempDir, {compile: 'always'});
    const page = await assertPageWorksCorrectly(url);
    await gotoOrDie(page, `${url}/`);
    assert.notInclude(
        await page.content(),
        'import.meta',
        'expected import.meta to be compiled out!');
  });

  suite('after building', () => {
    suiteSetup(async function() {
      this.timeout(20 * 1000);
      await runCommand(binPath, ['build'], {cwd: tempDir});
    });
    for (const buildOption of options.builds!) {
      const buildName = buildOption.name || 'default';
      testName = `import.meta works in build configuration ${buildName}`;
      test(testName, async function() {
        const url = await serve(
            path.join(tempDir, 'build', buildName), {compile: 'always'});
        const page = await assertPageWorksCorrectly(url, true);
        await gotoOrDie(page, `${url}/`);
        if (buildName !== 'esm-bundle') {
          assert.notInclude(
              await page.content(),
              'import.meta',
              'expected import.meta to be compiled out!');
        } else {
          assert.include(
              await page.content(),
              'import.meta',
              'expected import.meta to not be compiled out!');
        }
      });
    }
  });
});
