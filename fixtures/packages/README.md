Place test fixtures here!

Fixtures are checked in to enable deterministic CI testing. Each fixture directory has the following format: 

- `fixtures/packages/PACKAGE_NAME`: 
  - `/source/`: Checked in, Created by `npm run build:fixtures` 
  - `/expected/`: Checked in, Created by `npm run build:fixtures` 
  - `/generated/`: Created & compared by `npm run test:full` 
  - `/test.js`: Checked in, per-package test configuration
