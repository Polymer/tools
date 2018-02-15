# Polymer 3.0 Status Page

*Last run: 2018-02-06*

This table contains the status of every Polymer 3.0 element being run through automated testing.

## Legend

| icon | meaning |
|------|---------|
| ✅   | This step is passing, without errors |
| ⚠️   | The status of this step is unknown (see: "reason?") |
| ❌   | This step is failing, with errors (see: "reason?") |

## Support Table

| repo | `npm install`\* | `wct --npm` | reason? |
|------|---------------|------------|---------|
| app-layout | ✅ | ❌ | 3 failed tests |
| app-localize-behavior | ✅ | ✅ | |
| app-media | ✅ | ❌ | 12 failed tests bower -> npm issues |
| app-route | ✅ | ✅ | |
| app-storage | ✅ | ❌ | 2 failed tests |
| font-roboto | ✅ | ⚠️ | *No test suites were found matching your configuration* |
| font-roboto-local | ✅ | ⚠️ | *No test suites were found matching your configuration* |
| gold-cc-cvc-input | ✅ | ✅ | |
| gold-cc-expiration-input | ✅ | ✅ | |
| gold-cc-input | ✅ | ✅ | |
| gold-phone-input | ✅ | ✅ | |
| gold-zip-input | ✅ | ✅ | |
| iron-a11y-announcer | ✅ | ✅ | |
| iron-a11y-keys | ✅ | ✅ | |
| iron-a11y-keys-behavior | ✅ | ✅ | |
| iron-ajax | ✅ | ✅ | |
| iron-autogrow-textarea | ✅ | ✅ | |
| iron-behaviors | ✅ | ✅ | |
| iron-checked-element-behavior | ✅ | ✅ | |
| iron-collapse | ✅ | ✅ | |
| iron-component-page | ✅ | ✅ | |
| iron-demo-helpers | ✅ | ✅ | |
| iron-doc-viewer | ✅ | ✅ | |
| iron-dropdown | ✅ | ❌ | Error: expected 10 to equal 0 (5 tests) |
| iron-fit-behavior | ✅ | ❌ | 4 failed tests |
| iron-flex-layout | ✅ | ✅ | |
| iron-form | ✅ | ✅ | |
| iron-form-element-behavior | ✅ | ✅ | |
| iron-icon | ✅ | ✅ | |
| iron-icons | ✅ | ✅ | |
| iron-iconset | ✅ | ✅ | |
| iron-iconset-svg | ✅ | ✅ | |
| iron-image | ✅ | ✅ | |
| iron-input | ✅ | ✅ | |
| iron-jsonp-library | ✅ | ✅ | |
| iron-label | ✅ | ✅ | |
| iron-list | ✅ | ❌ | Error: buildDataSet is not defined |
| iron-localstorage | ✅ | ✅ | |
| iron-location | ✅ | ❌ | Error: Timeout of 10000ms exceeded.  |
| iron-media-query | ✅ | ✅ | |
| iron-menu-behavior | ✅ | ✅ | |
| iron-meta | ✅ | ✅ | |
| iron-overlay-behavior | ✅ | ❌ | 1 failed test (_boundScrollHandler is not defined) |
| iron-pages | ✅ | ✅ | |
| iron-range-behavior | ✅ | ✅ | |
| iron-resizable-behavior | ✅ | ❌ | 2 failed tests |
| iron-scroll-target-behavior | ✅ | ✅ | |
| iron-scroll-threshold | ✅ | ✅ | |
| iron-selector | ✅ | ✅ | |
| iron-test-helpers | ✅ | ❌ | 7 failed tests |
| iron-validatable-behavior | ✅ | ✅ | |
| iron-validator-behavior | ✅ | ✅ | |
| marked-element | ✅ | ✅ | |
| neon-animation | ✅ | ❌ | 4 failed tests |
| paper-badge | ✅ | ✅ | |
| paper-behaviors | ✅ | ✅ | |
| paper-button | ✅ | ✅ | |
| paper-card | ✅ | ✅ | |
| paper-checkbox | ✅ | ✅ | |
| paper-dialog | ✅ | ✅ | |
| paper-dialog-behavior | ✅ | ✅ | |
| paper-dialog-scrollable | ✅ | ✅ | |
| paper-drawer-panel | ✅ | ✅ | |
| paper-dropdown-menu | ✅ | ✅ | |
| paper-fab | ✅ | ✅ | |
| paper-header-panel | ✅ | ✅ | |
| paper-icon-button | ✅ | ✅ | |
| paper-input | ✅ | ❌ | 14 failed tests |
| paper-item | ✅ | ✅ | |
| paper-listbox | ✅ | ✅ | |
| paper-material | ✅ | ✅ | |
| paper-menu-button | ✅ | ✅ | |
| paper-progress | ✅ | ✅ | |
| paper-radio-button | ✅ | ✅ | |
| paper-radio-group | ✅ | ✅ | |
| paper-ripple | ✅ | ✅ | |
| paper-scroll-header-panel | ✅ | ✅ | |
| paper-slider | ✅ | ✅ | |
| paper-spinner | ✅ | ✅ | |
| paper-styles | ✅ | ⚠️ | *No test suites were found matching your configuration* |
| paper-swatch-picker | ✅ | ❌ | Error: Cannot read property 'call' of undefined |
| paper-tabs | ✅ | ✅ | |
| paper-toast | ✅ | ✅ | |
| paper-toggle-button | ✅ | ✅ | |
| paper-toolbar | ✅ | ✅ | |
| paper-tooltip | ✅ | ✅ | |
| platinum-sw | ✅ | ❌ | 12 failed tests |
| polymer | ✅ | ❌ | Error: chai is not defined |
| prism-element | ✅ | ✅ | |
| promise-polyfill | ✅ | ⚠️ | *No test suites were found matching your configuration* |
| test-fixture | ✅ | ❌ | 2 failed tests |

*\*Note: `npm install` is currently being used for testing instead of the planned `yarn install --flat` due to a yarn bug in multi-repo conversion & testing. See https://github.com/Polymer/polymer-modulizer/issues/254 for more info.*
