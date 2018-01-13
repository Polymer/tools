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

import nock = require('nock');

export const testApiToken = 'XXXXXXXXXXXXXXXXXXXXXXXX';

export function setup() {
  nock('https://api.github.com')
      .persist()
      .get('/repos/polymer/polymer')
      .query(true)
      .reply(
          200,
          {
            owner: {login: 'Polymer'},
            name: 'polymer',
            full_name: 'Polymer/polymer',
            clone_url: 'https://github.com/Polymer/polymer.git',
            default_branch: 'master'
          },
          {Status: '200 OK'});

  nock('https://api.github.com')
      .persist()
      .get('/orgs/polymerelements/repos')
      .query({access_token: testApiToken})
      .reply(
          200,
          [
            {
              owner: {login: 'PolymerElements'},
              name: 'paper-appbar',
              full_name: 'PolymerElements/paper-appbar',
              clone_url: 'https://github.com/PolymerElements/paper-appbar.git',
              defaultBranch: 'master'
            },
            {
              owner: {login: 'PolymerElements'},
              name: 'paper-button',
              full_name: 'PolymerElements/paper-button',
              clone_url: 'https://github.com/PolymerElements/paper-button.git',
              defaultBranch: 'master'
            },
            {
              owner: {login: 'PolymerElements'},
              name: 'iron-ajax',
              full_name: 'PolymerElements/iron-ajax',
              clone_url: 'https://github.com/PolymerElements/iron-ajax.git',
              defaultBranch: 'master'
            }
          ],
          {
            Status: '200 OK',
            Link:
                '<https://api.github.com/organizations/11639138/repos?page=2>; rel="next", <https://api.github.com/organizations/11639138/repos?page=5>; rel="last"'
          });

  nock('https://api.github.com')
      .persist()
      .get('/organizations/11639138/repos')
      .query({page: 2, access_token: testApiToken})
      .reply(200, [], {
        Status: '200 OK',
        Link:
            '<https://api.github.com/organizations/11639138/repos?page=1>; rel="last", <https://api.github.com/organizations/11639138/repos?page=1>; rel="first", <https://api.github.com/organizations/11639138/repos?page=1>; rel="prev"'
      });

  nock('https://api.github.com')
      .persist()
      .get('/repos/PolymerElements/paper-appbar/git/refs/heads/ABCDEFGH')
      .query({access_token: testApiToken})
      .reply(200, {ref: 'refs/heads/ABCDEFGH'}, {Status: '200 OK'});

  nock('https://api.github.com')
      .persist()
      .get('/repos/PolymerElements/paper-button/git/refs/heads/ABCDEFGH')
      .query({access_token: testApiToken})
      .reply(
          200,
          [
            {ref: 'refs/heads/ABCDEFGH-MATCH-1'},
            {ref: 'refs/heads/ABCDEFGH-MATCH-2'}
          ],
          {Status: '200 OK'});

  nock('https://api.github.com')
      .persist()
      .get('/repos/PolymerElements/iron-ajax/git/refs/heads/ABCDEFGH')
      .query({access_token: testApiToken})
      .reply(200, '', {Status: '404 NOT FOUND'});
}

export function teardown() {
  nock.cleanAll();
}
