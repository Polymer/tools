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

import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

import request = require('request');
import rimraf = require('rimraf');
import GitHubApi = require('@octokit/rest');

const gunzip = require('gunzip-maybe');
const tar = require('tar-fs');
const fileFilterList = [
  '.gitattributes',
  '.github',
  '.travis.yml',
];

export type RequestAPI = request.RequestAPI<
    request.Request,
    request.CoreOptions,
    request.RequiredUriUrl>;

export class GithubResponseError extends Error {
  readonly name = 'GithubResponseError';
  readonly statusCode: number|undefined;
  readonly statusMessage: string|undefined;
  readonly url: string;

  constructor(
      url: string, statusCode: number|undefined,
      statusMessage: string|undefined) {
    super(`${statusCode} fetching ${url} - ${statusMessage}`);
    this.url = url;
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
  }
}

export interface GithubOpts {
  owner: string;
  repo: string;
  githubToken?: string;
  githubApi?: GitHubApi;
  requestApi?: request
      .RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>;
}

export interface CodeSource {
  name: string;
  tarball_url: string;
}

export class Github {
  private _token: string|null;
  private _github: GitHubApi;
  private _request: request
      .RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>;
  private _owner: string;
  private _repo: string;

  static tokenFromFile(filename: string): string|null {
    try {
      return fs.readFileSync(filename, 'utf8').trim();
    } catch (error) {
      return null;
    }
  }

  constructor(opts: GithubOpts) {
    this._token = opts.githubToken || Github.tokenFromFile('token');
    this._owner = opts.owner;
    this._repo = opts.repo;
    this._github = opts.githubApi || new GitHubApi();
    if (this._token != null) {
      this._github.authenticate({
        type: 'oauth',
        token: this._token,
      });
    }
    this._request = opts.requestApi || request;
  }

  /**
   * Given a Github tarball URL, download and extract it into the outDir
   * directory.
   */
  async extractReleaseTarball(tarballUrl: string, outDir: string):
      Promise<void> {
    const tarPipe = tar.extract(outDir, {
      ignore: (_: {}, header: {name: string}) => {
        const splitPath = path.normalize(header.name).split(path.sep);
        // ignore the top directory in the tarfile to unpack directly to
        // the cwd
        return splitPath.length < 1 || splitPath[1] === '';
      },
      map: (header: {name: string}) => {
        const splitPath = path.normalize(header.name).split(path.sep);
        const unprefixed = splitPath.slice(1).join(path.sep).trim();
        // A ./ prefix is needed to unpack top-level files in the tar,
        // otherwise they're just not written
        header.name = path.join('.', unprefixed);
        return header;
      },
    });
    return new Promise<void>((resolve, reject) => {
      this._request({
            url: tarballUrl,
            headers: {
              'User-Agent': 'request',
              'Authorization': (this._token) ? `token ${this._token}` :
                                               undefined,
            }
          })
          .on('response',
              (response) => {
                if (response.statusCode !== 200) {
                  reject(new GithubResponseError(
                      tarballUrl, response.statusCode, response.statusMessage));
                  return;
                }
              })
          .on('error', reject)
          .pipe(gunzip())
          .on('error', reject)
          .pipe(tarPipe)
          .on('error', reject)
          .on('finish', () => {
            resolve();
          });
    });
  }

  /**
   * Given an extracted or cloned github directory, unlink files that are not
   * intended to exist in the template and serve other purposes in the gith
   * repository.
   */
  removeUnwantedFiles(outDir: string) {
    fileFilterList.forEach((filename) => {
      rimraf.sync(path.join(outDir, filename));
    });
  }

  /**
   * Get all Github releases and match their tag names against the given semver
   * range. Return the release with the latest possible match.
   */
  async getSemverRelease(semverRange: string): Promise<CodeSource> {
    // Note that we only see the 100 most recent releases. If we ever release
    // enough versions that this becomes a concern, we'll need to improve this
    // call to request multiple pages of results.
    const response = await this._github.repos.listReleases({
      owner: this._owner,
      repo: this._repo,
      per_page: 100,
    });
    const releases = response.data;
    const validReleaseVersions =
        releases.filter((r) => semver.valid(r.tag_name)).map((r) => r.tag_name);
    const maxSatisfyingReleaseVersion =
        semver.maxSatisfying(validReleaseVersions, semverRange);
    const maxSatisfyingRelease =
        releases.find((r) => r.tag_name === maxSatisfyingReleaseVersion);
    if (!maxSatisfyingRelease) {
      throw new Error(`${this._owner}/${this._repo} has no releases matching ${
          semverRange}.`);
    }
    return {
      name: maxSatisfyingRelease.tag_name,
      tarball_url: maxSatisfyingRelease.tarball_url
    };
  }

  async getBranch(branchName: string): Promise<CodeSource> {
    const response = await this._github.repos.getBranch(
        {owner: this._owner, repo: this._repo, branch: branchName});
    const branch = response.data;
    return {
      name: branch.name,
      tarball_url: `https://codeload.github.com/${this._owner}/${
          this._repo}/legacy.tar.gz/${branch.commit.sha}`
    };
  }

  async getTag(tagName: string): Promise<CodeSource> {
    const response = await this._github.repos.getReleaseByTag(
        {owner: this._owner, repo: this._repo, tag: tagName});
    const tag = response.data;
    return {name: tag.name, tarball_url: tag.tarball_url};
  }
}
