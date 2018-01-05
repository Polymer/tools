# Polymer 3.0 Status Page

*Last run: 2018-01-05*

This table contains the status of every Polymer 3.0 element being run through automated testing.

## Legend

| icon | meaning |
|------|---------|
| ✅   | This step is passing, without errors |
| ⚠️   | The status of this step is unknown (see: "reason?") |
| ❌   | This step is failing, with errors (see: "reason?") |

## Support Table

| repo | `npm install` | `npm test` | reason? |
|------|---------------|------------|---------|
| iron-a11y-announcer | ✅ | ❌ | Failed to execute \'setAttribute\' on \'Element\': \'aria-live\\\' is not a valid attribute name. |
| iron-a11y-keys | ✅ | ✅ |  |
| iron-a11y-keys-behavior | ✅ | ⚠️ | Timed out |
| iron-ajax | ✅ | ❌ | synchronousSuccessfulRequestOptions is not defined |
| iron-autogrow-textarea | ✅ | ⚠️ | Timed out |
| iron-behaviors | ✅ | ⚠️ | Timed out |
| iron-behaviors-collection | ✅ | ❌ | No test suites were found matching your configuration |
| iron-checked-element-behavior | ✅ | ✅ |  |
| iron-collapse | ✅ | ⚠️ | Timed out |
| iron-component-page | ✅ | ✅ |  |
| iron-demo-helpers | ✅ | ✅ |  |
| iron-doc-viewer | ✅ | ✅ |  |
| iron-dropdown | ✅ | ⚠️ | Timed out |
| iron-elements | ✅ | ✅ |  |
| iron-fit-behavior | ✅ | ❌ | 4 failed tests |
| iron-flex-layout | ✅ | ✅ |  |
| iron-form | ✅ | ✅ |  |
| iron-form-element-behavior | ✅ | ✅ |  |
| iron-icon | ✅ | ✅ |  |
| iron-icons | ✅ | ❌ | 2 failed tests |
| iron-iconset | ✅ | ✅ |  |
| iron-iconset-svg | ✅ | ✅ |  |
| iron-image | ✅ | ❌ | Failed to execute \'setAttribute\' on \'Element\': \'aria-label\\\' is not a valid attribute name. |
| iron-input | ✅ | ❌ | ❌ |  |
| iron-input-elements | ✅ | ❌ | No test suites were found matching your configuration |
| iron-jsonp-library | ✅ | ✅ |  |
| iron-label | ✅ | ⚠️ | Timed out |
| iron-list | ✅ | ⚠️ | Timed out |
| iron-localstorage | ✅ | ✅ |  |
| iron-location | ✅ | ❌ | Timeout of 10000ms exceeded |
| iron-media-query | ✅ | ✅ |  |
| iron-menu-behavior | ✅ | ⚠️ | Timed out |
| iron-meta | ✅ | ✅ |  |
| iron-overlay-behavior | ✅ | ❌ | MockInteractions is not defined |
| iron-pages | ✅ | ✅ |  |
| iron-range-behavior | ✅ | ✅ |  |
| iron-resizable-behavior | ✅ | ❌ | 2 failed tests |
| iron-scroll-target-behavior | ✅ | ❌ | Failed to construct \'HTMLElement\': Please use the \'new\' operator, this DOM object constructor cannot be called as a function.\ |
| iron-scroll-threshold | ✅ | ❌ | Error thrown outside of test function: Failed to construct \'HTMLElement\': Please use the \'new\' operator, this DOM object constructor cannot be called as a function. |
| iron-selector | ✅ | ❌ | 20 failed tests |
| iron-signals | ✅ | ❌ | No test suites were found matching your configuration |
| iron-swipeable-container | ✅ | ⚠️ | Timed out |
| iron-test-helpers | ✅ | ⚠️ | Timed out |
| iron-validatable-behavior | ✅ | ✅ |  |
| iron-validator-behavior | ✅ | ✅ |  |
| paper-badge | ✅ | ⚠️ | Timed out |
| paper-behaviors | ✅ | ⚠️ | Timed out |
| paper-button | ✅ | ❌ | ❌ | mock-interactions importing itself,  |
| paper-card | ✅ | ❌ | Error thrown outside of test function: the string "console.error: Error stamping [object HTMLTemplateElement] InvalidCharacterError: Failed to execute \'setAttribute\' on \'Element\': \'class\\\\\' is not a valid attribute name." |
| paper-checkbox | ✅ | ⚠️ | Timed out |
| paper-dialog | ✅ | ⚠️ | Timed out |
| paper-dialog-behavior | ✅ | ⚠️ | Timed out |
| paper-dialog-scrollable | ✅ | ⚠️ | Timed out |
| paper-drawer-panel | ✅ | ⚠️ | Timed out |
| paper-dropdown-menu | ✅ | ⚠️ | Timed out |
| paper-elements | ✅ | ⚠️ | Timed out (ERR! 404 Not Found: @polymer/paper-ui-elements@^3.0.0-pre.1) |
| paper-fab | ✅ | ✅ |  |
| paper-header-panel | ✅ | ❌ | Failed to execute \'setAttribute\' on \'Element\': \'class\\\' is not a valid attribute name. |
| paper-icon-button | ✅ | ⚠️ | Timed out |
| paper-input | ✅ | ⚠️ | Timed out |
| paper-input-elements | ✅ | ❌ | No test suites were found matching your configuration |
| paper-item | ✅ | ⚠️ | Timed out |
| paper-linear-progress | ✅ | ❌ | Failed to execute \'setAttribute\' on \'Element\': \'hidden\\\' is not a valid attribute name. |
| paper-listbox | ✅ | ⚠️ | Timed out |
| paper-material | ✅ | ✅ |  |
| paper-menu | ✅ | ⚠️ | Timed out |
| paper-menu-button | ✅ | ⚠️ | Timed out |
| paper-overlay-elements | ✅ | ❌ | No test suites were found matching your configuration |
| paper-progress | ✅ | ❌ | Failed to execute \'setAttribute\' on \'Element\': \'hidden\\\' is not a valid attribute name. |
| paper-radio-button | ✅ | ⚠️ | Timed out |
| paper-radio-group | ✅ | ⚠️ | Timed out |
| paper-ripple | ✅ | ⚠️ | Timed out |
| paper-scroll-header-panel | ✅ | ⚠️ | Timed out |
| paper-slider | ✅ | ⚠️ | Timed out |
| paper-spinner | ✅ | ✅ |  |
| paper-styles | ✅ | ❌ | No test suites were found matching your configuration |
| paper-swatch-picker | ✅ | ⚠️ | Timed out |
| paper-tabs | ✅ | ⚠️ | Timed out |
| paper-text-field | ✅ | ⚠️ | Timed out |
| paper-toast | ✅ | ⚠️ | Timed out |
| paper-toggle-button | ✅ | ⚠️ | Timed out |
| paper-toolbar | ✅ | ❌ | ❌ | Failed to execute \'setAttribute\' on \'Element\': \'class\\\' is not a valid attribute name. |
| paper-tooltip | ✅ | ❌ |  |
| paper-ui-elements | ✅ | ❌ | No test suites were found matching your configuration |
| polymer | ✅ | ⚠️ | Timed out |
| promise-polyfill | ✅ | ❌ | Error: No test suites were found matching your configuration |
| app-elements | ❌ | ❌ | No matching version found for @polymer/app-pouchdb@^3.0.0-pre.1 |
| app-layout | ✅ | ❌ | Failed to execute \'setAttribute\' on \'Element\': \'position\\\' is not a valid attribute name. |
| app-layout-templates | ❌ | ❌ | No matching version found for @polymer/app-pouchdb@^3.0.0-pre.1 |
| app-localize-behavior | ✅ | ⚠️ | Timed out |
| app-media | ✅ | ⚠️ | Timed out |
| app-pouchdb | ✅ | ⚠️ | Timed out |
| app-route | ✅ | ✅ |  |
| app-storage | ✅ | ⚠️ | Timed out |
| gold-cc-cvc-input | ✅ | ⚠️ | Timed out |
| gold-cc-expiration-input | ✅ | ⚠️ | Timed out |
| gold-cc-input | ✅ | ⚠️ | Timed out |
| gold-elements | ✅ | ❌ | Error: No test suites were found matching your configuration |
| gold-email-input | ✅ | ⚠️ | Timed out |
| gold-phone-input | ✅ | ⚠️ | Timed out |
| gold-zip-input | ✅ | ⚠️ | Timed out |
| neon-elements | ✅ | ❌ | Error: No test suites were found matching your configuration |
| neon-animation | ✅ | ⚠️ | Timed out |
| marked-element | ✅ | ⚠️ | Timed out |
| prism-element | ✅ | (no tests) | (no tests) |  |
| platinum-elements | ✅ | ❌ | Error: No test suites were found matching your configuration |
| platinum-bluetooth | ✅ | ⚠️ | Timed out |
| platinum-push-messaging | ✅ | ⚠️ | Timed out |
| platinum-sw | ✅ | ✅ |  |
| platinum-https-redirect | ✅ | ✅ |  |