## How to modulize and publish Polymer + elements

1. Edit `dependency-map.json` and bump every `^3.0.0-pre.<N>` version to
   `^3.0.0-pre.<N+1>`.

2. Run `modulizer --clean --npm-version 3.0.0-pre.<N+1> --repo $(cat <modulizer dir>/docs/polymer-modulize-repos.txt | tr '\n' ' ') --delete-files bower.json '**/*.d.ts' types/`. This should take 2-3 minutes.

3. Choose *"Install dependencies and run tests"*. This should take 15-20 minutes.
   Expect only Chrome tests to pass (see [#291](https://github.com/Polymer/polymer-modulizer/issues/291)). Look at the [Element status](https://github.com/Polymer/polymer-modulizer/blob/master/docs/polymer-3-element-status.md) doc and spot check that 5-10 elements that were previously passing are still passing.

4. Choose *"Push changes to GitHub"*. Change the branch name to `__auto_generated_3.0_preview` when prompted (see [#258](https://github.com/Polymer/polymer-modulizer/issues/258)).

5. Choose *"Publish changes to npm"*.

6. Submit a PR to update `dependency-map.json` with the changes made in step 1.
