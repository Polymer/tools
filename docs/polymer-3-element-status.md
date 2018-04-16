# Polymer 3.0 Status Page

-*Last run: See [Status Page Changelog](https://github.com/Polymer/polymer-modulizer/commits/master/docs/polymer-3-element-status.md)*

This table contains the status of every Polymer 3.0 element being run through automated testing.

## Legend

| icon | meaning |
|------|---------|
| ✅   | This step is passing, without errors |
| ⚠️   | The status of this step is unknown (see: "reason?") |
| ❌   | This step is failing, with errors (see: "reason?") |
| ❔   | Unknown |

## Support Table

| repo | `npm install`\* | Chrome | Safari | Firefox | reason? |
|------|-----------------|--------|--------|---------|---------|
| app-layout | ✅ | ✅ | ❔ | ❔ | |
| app-localize-behavior | ✅ | ❌ | ❌ | ✅ | polyfill does not support modules needs to be moved out of element and into tests |
| app-media | ✅ | ⚠️ | ⚠️ | ⚠️ | (Tooling Error) 'return' outside of function |
| app-route | ✅ | ✅ | ✅ | ✅ | |
| app-storage | ✅ | ❌| ❌ | ❌ | importPath not defined and certain js files not being copied |
| font-roboto | ✅ | ⚠️ | ⚠️ | ⚠️ | *No test suites were found matching your configuration* |
| font-roboto-local | ✅ | ⚠️ | ⚠️ | ⚠️ | *No test suites were found matching your configuration* |
| gold-cc-cvc-input | ✅ | ✅ | ✅ | ✅ | |
| gold-cc-expiration-input | ✅ | ✅ | ✅ | ✅ |  |
| gold-cc-input | ✅ | ✅ | ✅ | ✅ | |
| gold-phone-input | ✅ | ✅ | ❔ | ❔ | |
| gold-zip-input | ✅ | ✅ | ✅ | ✅ | |
| iron-a11y-announcer | ✅ | ✅ | ❔ | ❔ | |
| iron-a11y-keys | ✅ | ✅ | ✅ | ✅ | |
| iron-a11y-keys-behavior | ✅ | ✅ | ❔ | ❔ | |
| iron-ajax | ✅ | ✅ | ❔ | ❔ | |
| iron-autogrow-textarea | ✅ | ✅ | ❔ | ❔ | |
| iron-behaviors | ✅ | ✅ | ❔ | ❔ | |
| iron-checked-element-behavior | ✅ | ✅ | ❔ | ❔ | |
| iron-collapse | ✅ | ✅ | ❔ | ❔ | |
| iron-component-page | ✅ | ✅ | ✅ | ✅ | |
| iron-demo-helpers | ✅ | ✅ | ❔ | ❔ | |
| iron-doc-viewer | ✅ | ✅ | ✅ | ✅ | |
| iron-dropdown | ✅ | ❌ | ❌ | ❌ | Animations are broken and FF require.js is duplicating |
| iron-fit-behavior | ✅ | ✅ | ✅ | ✅ | |
| iron-flex-layout | ✅ | ✅ | ❔ | ❔ | |
| iron-form | ✅ | ❌ | ❌ | ❌ | iron-form-element-behavior fails paths to names |
| iron-form-element-behavior | ✅ | ✅ | ❔ | ❔ | |
| iron-icon | ✅ | ✅ | ❔ | ❔ | |
| iron-icons | ✅ | ✅ | ❔ | ❔ | |
| iron-iconset | ✅ | ✅ | ❔ | ❔ | |
| iron-iconset-svg | ✅ | ✅ | ❔ | ❔ | |
| iron-image | ✅ | ✅ | ❔ | ❔ | |
| iron-input | ✅ | ✅ | ❔ | ❔ | |
| iron-jsonp-library | ✅ | ✅ | ❔ | ❔ | |
| iron-label | ✅ | ✅ | ❔ | ❔ | |
| iron-list | ✅ | ❌ | ❌ | ❌ | 6 breaking tests. FF more; requirejs duplication |
| iron-localstorage | ✅ | ✅ | ❔ | ❔ | |
| iron-location | ✅ | ✅ | ✅ | ✅ | same as master |
| iron-media-query | ✅ | ✅ | ❔ | ❔ | |
| iron-menu-behavior | ✅ | ✅ | ❔ | ❔ | |
| iron-meta | ✅ | ✅ | ❔ | ❔ | |
| iron-overlay-behavior | ✅ | ✅ | ❌ | ✅ | Safari still fails due to script error everything else passes based on this [PR](https://github.com/PolymerElements/iron-overlay-behavior/pull/279) |
| iron-pages | ✅ | ✅ | ❔ | ❔ | |
| iron-range-behavior | ✅ | ✅ | ❔ | ❔ | |
| iron-resizable-behavior | ✅ | ✅ | ✅ | ✅ | same as master |
| iron-scroll-target-behavior | ✅ | ✅ | ❔ | ❔ | |
| iron-scroll-threshold | ✅ | ✅ | ❔ | ❔ | |
| iron-selector | ✅ | ✅ | ❔ | ❔ | |
| iron-test-helpers | ✅ | ❌ | ❌ | ❌ | 7 failed tests. Modularizing loses functionality. |
| iron-validatable-behavior | ✅ | ✅ | ❔ | ❔ | |
| iron-validator-behavior | ✅ | ✅ | ❔ | ❔ | |
| marked-element | ✅ | ✅ | ❔ | ❔ | |
| neon-animation | ✅ | ❌ | ❌ | ❌ | Web animations polyfill is ignored. |
| paper-badge | ✅ | ✅ | ❔ | ❔ | |
| paper-behaviors | ✅ | ✅ | ❔ | ❔ | |
| paper-button | ✅ | ✅ | ❔ | ❔ | |
| paper-card | ✅ | ✅ | ❔ | ❔ | |
| paper-checkbox | ✅ | ✅ | ❔ | ❔ | |
| paper-dialog | ✅ | ✅ | ❔ | ❔ | |
| paper-dialog-behavior | ✅ | ✅ | ❔ | ❔ | |
| paper-dialog-scrollable | ✅ | ✅ | ❔ | ❔ | |
| paper-drawer-panel | ✅ | ✅ | ❔ | ❔ | |
| paper-dropdown-menu | ✅ | ✅ | ✅ | ✅ | |
| paper-fab | ✅ | ✅ | ❔ | ❔ | |
| paper-header-panel | ✅ | ✅ | ❔ | ❔ | |
| paper-icon-button | ✅ | ✅ | ❔ | ❔ | |
| paper-input | ✅ | ✅ | ✅ | ❌ | Chrome fails in headless focus tests, FF 16 fails all the time |
| paper-item | ✅ | ✅ | ❔ | ❔ | |
| paper-listbox | ✅ | ✅ | ❔ | ❔ | |
| paper-material | ✅ | ✅ | ❔ | ❔ | |
| paper-menu-button | ✅ | ✅ | ✅ | ✅ | |
| paper-progress | ✅ | ✅ | ❔ | ❔ | |
| paper-radio-button | ✅ | ✅ | ❔ | ❔ | |
| paper-radio-group | ✅ | ✅ | ❔ | ❔ | |
| paper-ripple | ✅ | ✅ | ❔ | ❔ | |
| paper-scroll-header-panel | ✅ | ✅ | ❔ | ❔ | |
| paper-slider | ✅ | ✅ | ❔ | ❔ | |
| paper-spinner | ✅ | ✅ | ❔ | ❔ | |
| paper-styles | ✅ | ⚠️ | ⚠️ | ⚠️ | *No test suites were found matching your configuration* |
| paper-swatch-picker | ✅ | ❌ | ❌ | ❌ | Animations are broken |
| paper-tabs | ✅ | ✅ | ❔ | ❔ | |
| paper-toast | ✅ | ✅ | ❔ | ❔ | |
| paper-toggle-button | ✅ | ✅ | ❔ | ❔ | |
| paper-toolbar | ✅ | ✅ | ❔ | ❔ | |
| paper-tooltip | ✅ | ✅ | ❔ | ❔ | |
| platinum-sw | ✅ | ❌ | ❌ | ❌ | Fix is waiting on `importPath` |
| polymer | ✅ | ❌ | ❌ | ❌ | module is not defined |
| prism-element | ✅ | ✅ | ❔ | ❔ | |
| promise-polyfill | ✅ | ❌ | ❔ | ❔ | wct-browser-legacy not installed.  |
| test-fixture | ✅ | ❌ | ❔ | ❔ | Cannot read property \'import\' of null |

*\*Note: `npm install` is currently being used for testing instead of the planned `yarn install --flat` due to a yarn bug in multi-repo conversion & testing. See https://github.com/Polymer/polymer-modulizer/issues/254 for more info.*
