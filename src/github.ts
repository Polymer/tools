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

import * as GitHub from 'github';

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
export interface GitHubRepo extends GitHubRepoData { ref?: string; }

/**
 * Returns true if the response is a redirect to another repo
 */
function isSuccessResponse(response: any): boolean {
  return !!(
      response.meta && response.meta.status &&
      response.meta.status.match(/^200\b/));
}

/**
 * Returns true if the response is a redirect to another repo
 */
function isRedirectResponse(response: any): boolean {
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
 *
 * TODO(fks) 09-21-2017: Add back parallelization & throttling.
 *                       https://github.com/Polymer/polymer-workspaces/issues/2
 */
export class GitHubConnection {
  private _cache: Map<string, GitHubRepoData>;
  private _github: GitHub;

  constructor(token: string) {
    this.resetCache();
    this._github = new GitHub({protocol: 'https'});
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
    let pageRepos: GitHubRepoData[] = [];
    const pageSize = 50;
    let page = 1;
    let isOrg = true;

    do {
      let responseData;
      if (isOrg) {
        try {
          const response = await this._github.repos.getForOrg(
              {org: owner, per_page: pageSize, page: page});
          responseData = response.data;
        } catch (e) {
          // Owner is not an org? Continue as if owner is a user.
          isOrg = false;
        }
      }
      if (!isOrg) {
        try {
          const response = await this._github.repos.getForUser(
              {username: owner, per_page: pageSize, page: page});
          responseData = response.data;
        } catch (e) {
          // Owner is not an user, either? End and return any repos found.
          responseData = [];
        }
      }
      pageRepos = responseData.filter((obj: any) => !obj.private)
                      .map(createGitHubRepoDataFromApi);
      for (const repo of pageRepos) {
        this.setCache(repo.fullName, repo);
        allRepos.push(repo);
      }
      ++page;
    } while (pageRepos.length > 0);

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

    await Promise.all([...ownersToLookup].map((pattern): Promise<void> => {
      return (async () => {
        const owner = pattern.substring(0, pattern.indexOf('/')).toLowerCase();
        const namePattern =
            pattern.substring(0, pattern.indexOf('*')).toLowerCase();
        const ref = pattern.includes('#') &&
            pattern.substring(pattern.indexOf('#') + 1);
        const allOwnerRepos = await this.getOwnerRepos(owner);
        // Filter all of this owner's repos for possible matches:
        for (const possibleMatch of allOwnerRepos) {
          // If the repo's fullName doesn't match the pattern prefix, ignore it.
          if (!possibleMatch.fullName.toLowerCase().startsWith(namePattern)) {
            continue;
          }
          // If a branch was defined after the wildcard but this repo doesn't
          // have a ref with that name, ignore it.
          if (ref && ref !== possibleMatch.defaultBranch) {
            try {
              const response = await this._github.gitdata.getReference({
                owner: possibleMatch.owner,
                repo: possibleMatch.name,
                ref: 'heads/' + ref,
              });
              // GitHub API peculiarity: if ref isn't an exact match, GitHub
              // switches behavior and returns all references that have `ref` as
              // a prefix. Since we only want exact matches, add an extra check
              // that the API did not return an array.
              if (!isSuccessResponse(response) ||
                  Array.isArray(response.data)) {
                continue;
              }
            } catch (err) {
              continue;
            }
          }
          // Otherwise, it's a match! Add it to allGitHubRepos to be returned.
          allGitHubRepos.push(createGitHubRepoReferenceFromDataAndReference(
              possibleMatch, ref || possibleMatch.defaultBranch));
        }
      })();
    }));

    return allGitHubRepos;
  }
}
