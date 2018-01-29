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

| repo | *npm install* | *npm test* | reason? |
|------|---------------|------------|---------|
| app-elements| ❌ | ❌ | (npm install) No matching version found for @polymer/| app-pouchdb@^3.0.0-pre.1 |
| app-layout| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'position' is not a valid attribute name. |
| app-layout-templates| ✅ | ⚠️ | (no tests) |
| app-localize-behavior| ✅ | ✅ | | 
| app-media| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| app-pouchdb| ❌ | ❌ |  |
| app-route| ✅ | ✅ | | 
| app-storage| ✅ | ❌ | 3 failed tests |
| gold-cc-cvc-input| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| gold-cc-expiration-input| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'required' is not a valid attribute name. |
| gold-cc-input| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| gold-elements| ✅ | ⚠️ | (no tests) 
| gold-email-input| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'required' is not a valid attribute name. |
| gold-phone-input| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| gold-zip-input| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| iron-a11y-announcer| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'aria-live' is not a valid attribute name. |
| iron-a11y-keys| ✅ | ✅ | | 
| iron-a11y-keys-behavior| ✅ | ✅ | | 
| iron-ajax| ✅ | ❌ | synchronousSuccessfulRequestOptions is not defined |
| iron-autogrow-textarea| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'rows' is not a valid attribute name. |
| iron-behaviors| ✅ | ✅ | | 
| iron-behaviors-collection| ✅ | ⚠️ | (no tests) |
| iron-checked-element-behavior| ✅ | ✅ | | 
| iron-collapse| ✅ | ✅ | | 
| iron-component-page| ✅ | ✅ | | 
| iron-demo-helpers| ✅ | ✅ | | 
| iron-doc-viewer| ✅ | ✅ | | 
| iron-dropdown| ✅ | ❌ | Cannot read property 'call' of undefined |
| iron-elements| ❌ | ❌ | (npm install) 404 Not Found: @polymer/| icon-behaviors-collection@^3.0.0-pre.1 |
| iron-fit-behavior| ✅ | ❌ | 4 failed tests |
| iron-flex-layout| ✅ | ✅ | | 
| iron-form| ✅ | ✅ | | 
| iron-form-element-behavior| ✅ | ✅ | | 
| iron-icon| ✅ | ✅ | | 
| iron-icons| ✅ | ❌ | 2 failed tests |
| iron-iconset| ✅ | ✅ | | 
| iron-iconset-svg| ✅ | ✅ | | 
| iron-image| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'aria-label' is not a valid attribute name. |
| iron-input| ✅ | ❌ | 2 failed tests |
| iron-input-elements| ✅ | ⚠️ | (no tests) |
| iron-jsonp-library| ✅ | ✅ | | 
| iron-label| ✅ | ✅ | | 
| iron-list| ✅ | ❌ | buildDataSet is not defined |
| iron-localstorage| ✅ | ✅ | | 
| iron-location| ✅ | ❌ | Timeout of 10000ms exceeded. |
| iron-media-query| ✅ | ✅ | | 
| iron-menu-behavior| ✅ | ✅ | | 
| iron-meta| ✅ | ✅ | | 
| iron-overlay-behavior| ✅ | ⚠️ | Unknown
| iron-pages| ✅ | ✅ | | 
| iron-range-behavior| ✅ | ✅ | | 
| iron-resizable-behavior| ✅ | ❌ | 2 failed tests |
| iron-scroll-target-behavior| ✅ | ✅ | | 
| iron-scroll-threshold| ✅ | ✅ | | 
| iron-selector| ✅ | ✅ | | 
| iron-signals| ✅ | ❌ | test suites were found matching your configuration |
| iron-swipeable-container| ✅ | ❌ | 3 failed tests |
| iron-test-helpers| ✅ | ❌ | 9 failed tests |
| iron-validatable-behavior| ✅ | ✅ | | 
| iron-validator-behavior| ✅ | ✅ | | 
| marked-element| ✅ | ❌️ | Timed out |
| neon-animation| ✅ | ❌️ | Timed out |
| neon-elements| ✅ | ⚠️ | (no tests) |
| paper-badge| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-behaviors| ✅ | ❌ | 1 failed tests |
| paper-button| ✅ | ✅ | | 
| paper-card| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| paper-checkbox| ✅ | ✅ | | 
| paper-dialog| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-dialog-behavior| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-dialog-scrollable| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-drawer-panel| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-dropdown-menu| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-elements| ✅ | ⚠️ | (no tests) |
| paper-fab| ✅ | ✅ | | 
| paper-header-panel| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| paper-icon-button| ✅ | ❌ | 8 failed tests |
| paper-input| ✅ | ❌ | Timed out |
| paper-input-elements| ✅ | ⚠️ | (no tests) |
| paper-item| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| paper-linear-progress| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'hidden' is not | a valid attribute name. |
| paper-listbox| ✅ | ✅ | | 
| paper-material| ✅ | ✅ | | 
| paper-menu| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-menu-button| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-overlay-elements| ✅ | ⚠️ | (no tests)  |
| paper-progress| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'hidden' is not a valid attribute name. |
| paper-radio-button| ✅ | ✅ | | 
| paper-radio-group| ✅ | ✅ | | 
| paper-ripple| ✅ | ✅ | | 
| paper-scroll-header-panel| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-slider| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'hidden' is not a valid attribute name. |
| paper-spinner| ✅ | ✅  | |
| paper-styles| ✅ | ❌ | test suites were found matching your configuration |
| paper-swatch-picker| ✅ | ❌ | 6 failed tests |
| paper-tabs| ✅ | ❌ | 12 failed tests |
| paper-text-field| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| paper-toast| ✅ | ❌ | The requested module does not provide an export named 'Settings' |
| paper-toggle-button| ✅ | ✅ | | 
| paper-toolbar| ✅ | ❌ | Failed to execute 'setAttribute' on 'Element': 'class' is not a valid attribute name. |
| paper-tooltip| ✅ | ✅ | | 
| paper-ui-elements| ✅ | ⚠️ | (no tests) |
| polymer| ✅ | ❌ | chai is undefined |
| platinum-https-redirect| ✅ | ✅ | | 
| platinum-push-messaging| ✅ | ❌️ | Timed out |
| platinum-sw| ✅ | ✅ | | 
| prism-element| ✅ | ⚠️ | (no tests) |
| promise-polyfill| ✅ | ⚠️ | (no tests) |
