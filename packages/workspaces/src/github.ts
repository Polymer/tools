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

import * as GitHubApi from '@octokit/rest';
import {AnyResponse} from '@octokit/rest';
import {batchProcess, githubConcurrencyPreset} from './util/batch-process';

/**
 * A reference to a GitHub repo, with an optional reference to a specific ref
 * (branch/tag/sha).
 */
export interface GitHubRepoReference {
  owner: string;
  name: string;
  fullName: string;
  ref?: string;
}

/**
 * All GitHub repo data, returned from the GitHub API. This data is independent
 * from any one reference and can be cached for multiple runs /
 * GitHubRepoReference objects.
 */
export interface GitHubRepoData {
  owner: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  defaultBranch: string;
}

/**
 * A complete GitHub repo object. Includes all data from GitHub and an optional
 * reference to a specific branch/tag/sha/etc.
 */
export interface GitHubRepo extends GitHubRepoData {
  ref?: string;
}

/**
 * Returns true if the response is a redirect to another repo
 */
function isSuccessResponse(response: AnyResponse): boolean {
  return !!(
      response.meta && response.meta.status &&
      response.meta.status.match(/^200\b/));
}

/**
 * Returns true if the response is a redirect to another repo
 */
function isRedirectResponse(response: AnyResponse): boolean {
  return !!(
      response.meta && response.meta.status &&
      response.meta.status.match(/^301\b/));
}

/**
 * Given a GitHub API Repo object, return a formatted GitHubRepoData object.
 */
function createGitHubRepoDataFromApi(obj: any): GitHubRepoData {
  return {
    owner: obj.owner.login,
    name: obj.name,
    fullName: obj.full_name,
    cloneUrl: obj.clone_url,
    defaultBranch: obj.default_branch
  };
}

/**
 * Create a simpiler GitHubRepoReference object from a GitHubRepoData object and
 * a references string.
 */
function createGitHubRepoReferenceFromDataAndReference(
    data: GitHubRepoData, ref?: string): GitHubRepoReference {
  return {
    fullName: data.fullName,
    owner: data.owner,
    name: data.name,
    ref: ref,
  };
}

/**
 * Given a GitHubRepoData object & an optional reference, returns a full
 * GitHubRepo object.
 */
function createGitHubRepoFromDataAndReference(
    data: GitHubRepoData, ref?: string): GitHubRepo {
  return {...data, ref};
}


/**
 * Given a reference pattern (of form `user/repo` or `user/repo#ref`), return
 * an expanded reference object. Throw error if pattern is incorrectly
 * formatted.
 */
function createGithubRepoReferenceFromPattern(pattern: string):
    GitHubRepoReference {
  // NOTE(fks) 10-03-2017: This can be replaced with RegEx for perf, if needed.
  const hashSplit = pattern.split('#');
  const slashSplit = hashSplit[0].split('/');

  if (slashSplit.length !== 2 || hashSplit.length > 2) {
    throw new Error(`"${pattern}" is not in form user/repo or user/repo#ref`);
  }

  return {
    fullName: hashSplit[0],
    owner: slashSplit[0],
    name: slashSplit[1],
    ref: hashSplit[1] || undefined
  };
}

/**
 * GitHubConnection is a wrapper class for the GitHub npm package that
 * assumes action as-a-user, and a minimal set of supported API calls (mostly
 * to do with listing and cloning owned repos) using a token and building in
 * rate-limiting functionality using the Bottleneck library to throttle API
 * consumption.
 */
export class GitHubConnection {
  private _cache!: Map<string, GitHubRepoData>;
  private _github: GitHubApi;

  constructor(token: string) {
    this.resetCache();
    this._github = new GitHubApi({protocol: 'https'});
    this._github.authenticate({type: 'oauth', token: token});
  }

  resetCache() {
    this._cache = new Map();
  }

  setCache(key: string, value: GitHubRepoData) {
    return this._cache.set(key.toLowerCase(), value);
  }

  getCached(key: string): GitHubRepoData|undefined {
    return this._cache.get(key.toLowerCase());
  }

  /**
   * Given a GitHubRepoReference, load its full, hydrated GitHubRepo object.
   */
  async getRepoInfo(repoReference: GitHubRepoReference): Promise<GitHubRepo> {
    const cachedRepo = this.getCached(repoReference.fullName);
    if (cachedRepo !== undefined) {
      return createGitHubRepoFromDataAndReference(
          cachedRepo, repoReference.ref);
    }
    const response = await this._github.repos.get(
        {owner: repoReference.owner, repo: repoReference.name});
    // TODO(usergenic): Patch to _handle_ redirects and/or include
    // details in error messaging.  This was encountered because we
    // tried to request Polymer/hydrolysis which has been renamed to
    // Polymer/polymer-analyzer and the API doesn't auto-follow this.
    if (isRedirectResponse(response)) {
      console.log('Repo ${owner}/${repo} has moved permanently.');
      console.log(response);
      throw new Error(`Repo ${repoReference.owner}/${
          repoReference.name} could not be loaded.`);
    }
    const repoData = createGitHubRepoDataFromApi(response.data);
    this.setCache(repoReference.fullName, repoData);
    return createGitHubRepoFromDataAndReference(repoData, repoReference.ref);
  }

  /**
   * Returns an array of repos for the given owner or organization.
   * Caches all loaded repos for quick access later as well.
   */
  async getOwnerRepos(owner: string): Promise<GitHubRepoData[]> {
    // Try to get the repo names assuming owner is an org.
    const allRepos: GitHubRepoData[] = [];
    let isOrg = true;
    let hasNextPage = false;
    let responseData: any[] = [];
    let responseMeta: any;

    if (isOrg) {
      try {
        const response = await this._github.repos.getForOrg({org: owner});
        responseData = response.data;
        responseMeta = response.meta;
      } catch (e) {
        // Owner is not an org? Continue as if owner is a user.
        isOrg = false;
      }
    }
    if (!isOrg) {
      try {
        const response = await this._github.repos.getForUser({username: owner});
        responseData = response.data;
        responseMeta = response.meta;
      } catch (e) {
        // Owner is not an user, either? End and return any repos found.
      }
    }

    while (hasNextPage || responseData.length > 0) {
      responseData.filter((obj: any) => !obj.private)
          .map(createGitHubRepoDataFromApi)
          .forEach((repo: GitHubRepoData) => {
            this.setCache(repo.fullName, repo);
            allRepos.push(repo);
          });

      if (hasNextPage = !!this._github.hasNextPage(responseMeta)) {
        try {
          const response: any = await this._github.getNextPage(responseMeta);
          responseData = response.data;
          responseMeta = response.meta;
        } catch (e) {
          hasNextPage = false;
          responseData = [];
        }
      }
    }

    return allRepos;
  }

  /**
   * Given a collection of repo patterns, replace any that represent wildcard
   * values with the literal values after comparing against names of repos on
   * GitHub.
   *
   * Examples:
   * - `Polymer/*` => expands to everything owned by Polymer org
   * - `PolymerElements/iron-*` => expands to all `iron-*` repos owned by
   *   the PolymerElements org.
   * - `PolymerElements/*#2.0-preview` => expands to everything owned by the
   *   PolymerElements org, with a specific reference to their "2.0-preview"
   *   branches.
   */
  async expandRepoPatterns(repoPatterns: string[]):
      Promise<GitHubRepoReference[]> {
    const allGitHubRepos: GitHubRepoReference[] = [];
    const ownersToLookup: Set<string> = new Set();

    for (const repoPattern of repoPatterns) {
      if (!repoPattern.match(/\//)) {
        console.log(
            `WARNING: repo "${repoPattern}" must be of the ` +
            `GitHub format "owner/repo" or "owner/repo#ref". Ignoring...`);
        continue;
      }
      if (repoPattern.match(/\*/)) {
        ownersToLookup.add(repoPattern);
      } else {
        allGitHubRepos.push(createGithubRepoReferenceFromPattern(repoPattern));
      }
    }

    if (ownersToLookup.size === 0) {
      return allGitHubRepos;
    }

    for (const pattern of ownersToLookup) {
      const namePattern =
          pattern.substring(0, pattern.indexOf('*')).toLowerCase();
      const ref =
          pattern.includes('#') && pattern.substring(pattern.indexOf('#') + 1);
      const owner = pattern.substring(0, pattern.indexOf('/')).toLowerCase();
      const allOwnerRepos = await this.getOwnerRepos(owner);
      // Filter all of this owner's repos for possible matches:
      await batchProcess(allOwnerRepos, async (possibleMatch) => {
        // If the repo's fullName doesn't match the pattern prefix, ignore it.
        if (!possibleMatch.fullName.toLowerCase().startsWith(namePattern)) {
          return;
        }
        // If a branch was defined after the wildcard but this repo doesn't
        // have a ref with that name, ignore it.
        // TODO(fks) 10-16-2017: Report reference match failures?
        if (ref && ref !== possibleMatch.defaultBranch) {
          const response = await this._github.gitdata.getReference({
            owner: possibleMatch.owner,
            repo: possibleMatch.name,
            ref: 'heads/' + ref,
          });
          // GitHub API peculiarity: if ref isn't an exact match, GitHub
          // switches behavior and returns all references that have `ref` as
          // a prefix. Since we only want exact matches, add an extra check
          // that the API did not return an array.
          if (!isSuccessResponse(response) || Array.isArray(response.data)) {
            return;
          }
        }
        // Otherwise, it's a match! Add it to allGitHubRepos to be returned.
        allGitHubRepos.push(createGitHubRepoReferenceFromDataAndReference(
            possibleMatch, ref || possibleMatch.defaultBranch));
      }, {concurrency: githubConcurrencyPreset});
    }

    return allGitHubRepos;
  }
}
