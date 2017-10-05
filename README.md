# polymer-workspaces

Perform work across multiple GitHub repos. Useful for simple batch updates & batch publishing across all Polymer elements, tools, and/or libraries.

```
yarn add polymer-workspaces
```

## Usage Example: Initialization

```js
const {Workspace} = require('polymer-workspace');
const path = require('path');

const ws = new Workspace({
  // get a GitHub API token: https://github.com/blog/1509-personal-api-tokens
  token: 'GITHUB_API_TOKEN',
  // and choose a "workspace" directory
  dir: path.resolve(process.cwd(), '.workspace');
});

const initializedRepos = await ws.init({
    include: [
      'Polymer/polymer#2.0-preview',
      'Polymer/*',
    ]
  }, {verbose: true});
```

## Usage Example: Running Tasks Across Multiple Repos

```js
await ws.run(async(repo) => {
  // Contrived Example: Copy the "main" package.json property to "module"
  const packageManifestLoc = path.join(repo.dir, 'package.json');
  const packageManifestStr = fs.readFileSync(packageManifestLoc);
  const packageManifestJson = JSON.parse(packageManifestStr);
  packageManifestJson.module = packageManifestJson.main;
  fs.writeFileSync(packageManifestLoc, JSON.stringify(packageManifestJson));
});
```


## Usage Example: Git Pushing Multiple Repos

Coming Soon!


## Usage Example: NPM Publishing Multiple Repos

Coming Soon!