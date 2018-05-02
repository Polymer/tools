## How to modulize and publish Polymer + elements

1. Edit `dependency-map.json` and bump every `^3.0.0-pre.<N>` version to
   `^3.0.0-pre.<N+1>`.

2. Run `NODE_OPTIONS="--max_old_space_size=8192" modulizer --clean --npm-version 3.0.0-pre.<N+1> --repo $(cat <modulizer dir>/docs/polymer-modulize-repos.txt | tr '\n' ' ') --delete-files bower.json '**/*.d.ts' types/ --import-style name`. This should take 2-3 minutes.

3. Open `modulizer_workspace/iron-overlay-behavior/iron-scroll-manager.js` and change the line `_boundScrollHandler || _scrollInteractionHandler.bind(Polymer.IronScrollManager);` to `_boundScrollHandler || _scrollInteractionHandler.bind(undefined);` (until [#345](https://github.com/Polymer/polymer-modulizer/issues/345) is resolved.

4. Choose **"Install dependencies and run tests":** This should take 15-20 minutes when run with `--npm -l chrome` or `--npm --module-resolution=node -l chrome` flags (We specifically include "-l chrome" to only run tests in Chrome. Testing 90+ elements across multiple browsers is the goal, but it currently takes too long and generates too much noise to reliably parse.)

5. Compare the test results with the [Element status](https://github.com/Polymer/polymer-modulizer/blob/master/docs/polymer-3-element-status.md) doc and spot check that 5-10 elements that were previously passing are still passing.

6. Choose **"Push changes to GitHub":** Change the branch name to `__auto_generated_3.0_preview` when prompted (see [#258](https://github.com/Polymer/polymer-modulizer/issues/258)).

7. Choose **"Publish changes to npm".**

8. Submit a PR to update `dependency-map.json` with the changes made in step 1.
