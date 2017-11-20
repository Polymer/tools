# Test Fixtures

Fixtures are checked in to enable deterministic CI testing. Each fixture directory has the following format:

- `fixtures/packages/PACKAGE_NAME`:
  - `/source/`: Checked in, Created by `npm run build:fixtures`
  - `/expected/`: Checked in, Created by `npm run build:fixtures`
  - `/generated/`: Not checked in, created at test-time `npm run test:full`
  - `/test.js`: Checked in, per-package test configuration

## Updating Fixtures

Fixtures won't update manually. They require a manual run of the `build:fixtures` package.json script. This script runs `update-fixtures.ts`, which is keeps a list of all fixtures to fetch from github (`-> /source/`) and then convert (`-> /expected/`).

Note that `build:fixtures` trusts that the converter is in a working state when run. Make sure you only check in conversions from a working version of modulizer (usually a checkout of the master branch). Check the output & git diff manually after running just to be sure.

## Adding New Fixtures

1. Add new fixture to `update-fixtures.ts`.
2. run `build:fixtures` to save the fixture source & expected output.
3. Create a `test.js` file to configure how the test will be run.

## Configuring Fixtures

- Check out existing `test.js` files for example test configurations.
- Check out `fixtures-test.ts` to see how that configuration is read & handled.
