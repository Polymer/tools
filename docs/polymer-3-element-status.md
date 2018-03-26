# Polymer 3.0 Status Page

-*Last run: See [Status Page Changelog](https://github.com/Polymer/polymer-modulizer/commits/master/docs/polymer-3-element-status.md)*

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
| app-layout | ✅ | ✅ | |
| app-localize-behavior | ✅ | ❌ | Cannot find module 'intl-messageformat' |
| app-media | ✅ | ⚠️ | (Tooling Error) 'return' outside of function |
| app-route | ✅ | ✅ | |
| app-storage | ✅ | ❌ | Cannot read property \'ownerDocument\' of null |
| font-roboto | ✅ | ⚠️ | *No test suites were found matching your configuration* |
| font-roboto-local | ✅ | ⚠️ | *No test suites were found matching your configuration* |
| gold-cc-cvc-input | ✅ | ✅ | |
| gold-cc-expiration-input | ✅ | ❌ | Blocked a frame with origin "http://localhost:8081" from accessing a cross-origin frame. |
| gold-cc-input | ✅ | ✅ | |
| gold-phone-input | ✅ | ✅ | |
| gold-zip-input | ✅ | ✅ | |
| iron-a11y-announcer | ✅ | ✅ | |
| iron-a11y-keys | ✅ | ❌ | wct-browser-legacy not installed |
| iron-a11y-keys-behavior | ✅ | ✅ | |
| iron-ajax | ✅ | ✅ | |
| iron-autogrow-textarea | ✅ | ✅ | |
| iron-behaviors | ✅ | ✅ | |
| iron-checked-element-behavior | ✅ | ✅ | |
| iron-collapse | ✅ | ✅ | |
| iron-component-page | ✅ | ❌ | Tests failed: Timed out |
| iron-demo-helpers | ✅ | ✅ | |
| iron-doc-viewer | ✅ | ❌ | 3 failed tests |
| iron-dropdown | ✅ | ❌ | _boundScrollHandler is not defined |
| iron-fit-behavior | ✅ | ❌ | 4 failed tests |
| iron-flex-layout | ✅ | ✅ | |
| iron-form | ✅ | ❌ | Blocked a frame with origin "http://localhost:8081" from accessing a cross-origin frame. |
| iron-form-element-behavior | ✅ | ✅ | |
| iron-icon | ✅ | ✅ | |
| iron-icons | ✅ | ✅ | |
| iron-iconset | ✅ | ✅ | |
| iron-iconset-svg | ✅ | ✅ | |
| iron-image | ✅ | ✅ | |
| iron-input | ✅ | ✅ | |
| iron-jsonp-library | ✅ | ✅ | |
| iron-label | ✅ | ✅ | |
| iron-list | ✅ | ❌ | 14 failed tests |
| iron-localstorage | ✅ | ✅ | |
| iron-location | ✅ | ❌ | Timeout of 10000ms exceeded |
| iron-media-query | ✅ | ✅ | |
| iron-menu-behavior | ✅ | ✅ | |
| iron-meta | ✅ | ✅ | |
| iron-overlay-behavior | ✅ | ❌ | styleZ is not defined |
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
| neon-animation | ✅ | ❌ | KeyframeEffect is not defined |
| paper-badge | ✅ | ✅ | |
| paper-behaviors | ✅ | ✅ | |
| paper-button | ✅ | ✅ | |
| paper-card | ✅ | ✅ | |
| paper-checkbox | ✅ | ✅ | |
| paper-dialog | ✅ | ✅ | |
| paper-dialog-behavior | ✅ | ✅ | |
| paper-dialog-scrollable | ✅ | ✅ | |
| paper-drawer-panel | ✅ | ✅ | |
| paper-dropdown-menu | ✅ | ❌ | _boundScrollHandler is not defined |
| paper-fab | ✅ | ✅ | |
| paper-header-panel | ✅ | ✅ | |
| paper-icon-button | ✅ | ✅ | |
| paper-input | ✅ | ❌ | 14 failed tests |
| paper-item | ✅ | ✅ | |
| paper-listbox | ✅ | ✅ | |
| paper-material | ✅ | ✅ | |
| paper-menu-button | ✅ | ❌ | _boundScrollHandler is not defined |
| paper-progress | ✅ | ✅ | |
| paper-radio-button | ✅ | ✅ | |
| paper-radio-group | ✅ | ✅ | |
| paper-ripple | ✅ | ✅ | |
| paper-scroll-header-panel | ✅ | ✅ | |
| paper-slider | ✅ | ✅ | |
| paper-spinner | ✅ | ✅ | |
| paper-styles | ✅ | ⚠️ | *No test suites were found matching your configuration* |
| paper-swatch-picker | ✅ | ❌ | _boundScrollHandler is not defined |
| paper-tabs | ✅ | ✅ | |
| paper-toast | ✅ | ✅ | |
| paper-toggle-button | ✅ | ✅ | |
| paper-toolbar | ✅ | ✅ | |
| paper-tooltip | ✅ | ✅ | |
| platinum-sw | ✅ | ❌ | Cannot read property \'ownerDocument\' of null |
| polymer | ✅ | ❌ | module is not defined |
| prism-element | ✅ | ✅ | |
| promise-polyfill | ✅ | ❌ | wct-browser-legacy not installed.  |
| test-fixture | ✅ | ❌ | Cannot read property \'import\' of null |

*\*Note: `npm install` is currently being used for testing instead of the planned `yarn install --flat` due to a yarn bug in multi-repo conversion & testing. See https://github.com/Polymer/polymer-modulizer/issues/254 for more info.*
