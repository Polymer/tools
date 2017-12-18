# polymer-workspaces

Perform work across multiple GitHub repos. Useful for both simple and complex changes across multiple Polymer elements, tools, and/or libraries.

```
npm install --save polymer-workspaces
```

## Example: Creating a New Workspace

```js
const {Workspace} = require('polymer-workspace');
const path = require('path');

const workspace = new Workspace({
  // Choose a "workspace" directory
  dir: path.resolve(process.cwd(), 'my-workspace'),
  // Choose your repos (glob-matching supported)
  include: [
    'Polymer/polymer',
    'PolymerElements/*#2.0-preview',
  ],
  // (Optional) Exclude some repos (glob-matching supported)
  excludes: ['PolymerElements/iron-ajax'],
  // Include a valid GitHub API token: https://github.com/blog/1509-personal-api-tokens
  token: 'GITHUB_API_TOKEN',
});

// Check out & set up the given repos from GitHub.
const workspaceRepos = await workspace.init();

// Optional: Install all required bower dependencies alongside the requested repos.
await workspace.installBowerDependencies();
```


## Example: Running Tasks Across Repos

```js
const {run} = require('polymer-workspace');

const {successes, failures} = await run(workspaceRepos, async(repo) => {
  // Contrived Example: Copy the "main" package.json property to "module"
  const packageManifestLoc = path.join(repo.dir, 'package.json');
  const packageManifestStr = fs.readFileSync(packageManifestLoc);
  const packageManifestJson = JSON.parse(packageManifestStr);
  packageManifestJson.module = packageManifestJson.main;
  fs.writeFileSync(packageManifestLoc, JSON.stringify(packageManifestJson));
});

// Remember to handle/report any errors:
for ([workspaceRepo, err] of failures) {
  console.log(workspaceRepo.dir, err.message);
}
```


## Example: Pushing Multiple Repos

```js
const {startNewBranch, run, commitChanges, pushChangesToGithub} = require('polymer-workspace');

await startNewBranch(workspaceRepos, 'new-branch-name');
await run(workspaceRepos, async(repo) => { /* ... */ });
await commitChanges(workspaceRepos, 'this is your new commit message!');
await pushChangesToGithub(workspaceRepos);
```


## Example: NPM Publishing Multiple Repos

```js
const {run, publishPackagesToNpm} = require('polymer-workspace');

await run(workspaceRepos, async(repo) => { /* ... */ });
await publishPackagesToNpm(workspaceRepos, 'next');
```
