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

import {assert} from 'chai';
import {GitHubConnection} from '../github';
import * as mockApi from './_util/mock-api';
import {testApiToken} from './_util/mock-api';


suite('src/github', () => {
  suiteSetup(() => {
    mockApi.setup();
  });

  suiteTeardown(() => {
    mockApi.teardown();
  });

  suite('GitHubConnection', () => {
    suite('githubConnection.expandRepoPatterns()', () => {
      let githubConnection: GitHubConnection;

      setup(() => {
        githubConnection = new GitHubConnection(testApiToken);
      });

      test('handles static owner/name pattern', async () => {
        const references =
            await githubConnection.expandRepoPatterns(['polymer/polymer']);
        assert.deepEqual(references, [{
                           fullName: 'polymer/polymer',
                           owner: 'polymer',
                           name: 'polymer',
                           ref: undefined,
                         }]);
      });

      test('handles static owner/name#ref pattern', async () => {
        const references = await githubConnection.expandRepoPatterns(
            ['polymer/polymer#some-branch']);
        assert.deepEqual(references, [{
                           fullName: 'polymer/polymer',
                           owner: 'polymer',
                           name: 'polymer',
                           ref: 'some-branch',
                         }]);
      });

      test('handles dynamic owner/* pattern', async () => {
        const references =
            await githubConnection.expandRepoPatterns(['polymerelements/*']);
        assert.deepEqual(references, [
          {
            owner: 'PolymerElements',
            name: 'paper-appbar',
            fullName: 'PolymerElements/paper-appbar',
            ref: undefined
          },
          {
            owner: 'PolymerElements',
            name: 'paper-button',
            fullName: 'PolymerElements/paper-button',
            ref: undefined
          },
          {
            owner: 'PolymerElements',
            name: 'iron-ajax',
            fullName: 'PolymerElements/iron-ajax',
            ref: undefined
          }
        ]);
      });

      test('handles dynamic owner/*#ref pattern', async () => {
        const references = await githubConnection.expandRepoPatterns(
            ['polymerelements/*#ABCDEFGH']);
        assert.deepEqual(references, [{
                           owner: 'PolymerElements',
                           name: 'paper-appbar',
                           fullName: 'PolymerElements/paper-appbar',
                           ref: 'ABCDEFGH'
                         }]);
      });

      test('handles dynamic owner/partial-name-* pattern', async () => {
        assert.deepEqual(
            await githubConnection.expandRepoPatterns(
                ['polymerelements/paper-*']),
            [
              {
                owner: 'PolymerElements',
                name: 'paper-appbar',
                fullName: 'PolymerElements/paper-appbar',
                ref: undefined
              },
              {
                owner: 'PolymerElements',
                name: 'paper-button',
                fullName: 'PolymerElements/paper-button',
                ref: undefined
              },
            ]);
        assert.deepEqual(
            await githubConnection.expandRepoPatterns(
                ['polymerelements/iron-*']),
            [
              {
                owner: 'PolymerElements',
                name: 'iron-ajax',
                fullName: 'PolymerElements/iron-ajax',
                ref: undefined
              },
            ]);
      });

      test('handles dynamic owner/partial-name-*#ref pattern', async () => {
        assert.deepEqual(
            await githubConnection.expandRepoPatterns(
                ['polymerelements/paper-*#ABCDEFGH']),
            [
              {
                owner: 'PolymerElements',
                name: 'paper-appbar',
                fullName: 'PolymerElements/paper-appbar',
                ref: 'ABCDEFGH'
              },
            ]);
        assert.deepEqual(
            await githubConnection.expandRepoPatterns(
                ['polymerelements/iron-*#ABCDEFGH']),
            []);
      });
    });

    suite('githubConnection.getRepoInfo()', () => {
      test('returns full GitHubRepo object from a reference', async () => {
        const githubConnection = new GitHubConnection(testApiToken);
        const repo = await githubConnection.getRepoInfo(
            {owner: 'polymer', name: 'polymer', fullName: 'polymer/polymer'});
        assert.deepEqual(repo, {
          owner: 'Polymer',
          name: 'polymer',
          fullName: 'Polymer/polymer',
          cloneUrl: 'https://github.com/Polymer/polymer.git',
          defaultBranch: 'master',
          ref: undefined,
        });
      });

      test(
          'returns full GitHubRepo object from a reference to a specific branch',
          async () => {
            const githubConnection = new GitHubConnection(testApiToken);
            const repo = await githubConnection.getRepoInfo({
              owner: 'polymer',
              name: 'polymer',
              fullName: 'polymer/polymer',
              ref: 'some-branch'
            });
            assert.deepEqual(repo, {
              owner: 'Polymer',
              name: 'polymer',
              fullName: 'Polymer/polymer',
              cloneUrl: 'https://github.com/Polymer/polymer.git',
              defaultBranch: 'master',
              ref: 'some-branch',
            });
          });

      test('caches loaded repos for later', async () => {
        const githubConnection = new GitHubConnection(testApiToken);
        const repoNotCached = githubConnection.getCached('polymer/polymer');
        assert.isUndefined(repoNotCached);

        await githubConnection.getRepoInfo(
            {owner: 'polymer', name: 'polymer', fullName: 'polymer/polymer'});
        const repoCached = githubConnection.getCached('polymer/polymer');
        assert.isDefined(repoCached);
      });
    });
  });
});