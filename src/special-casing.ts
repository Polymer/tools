import {ResolvedUrl} from 'polymer-analyzer';

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

// TODO(fks) 07-06-2015: Convert this to a configurable option
export const polymerFileOverrides: ReadonlyMap<ResolvedUrl, string> = new Map([
  // 'lib/utils/boot.html' - This is a special file that overwrites exports
  // and does other things that make less sense in an ESM world.
  [
    'lib/utils/boot.html' as ResolvedUrl,
    `<script>
  window.JSCompiler_renameProperty = function(prop, obj) { return prop; }

  /** @namespace Polymer */
  let __PolymerBootstrap;
</script>`
  ],

  // Temporary workaround while we consider better options for the
  // WebComponentsReady event.
  // See: https://github.com/Polymer/polymer-modulizer/issues/111
  [
    'lib/utils/unresolved.html' as ResolvedUrl,
    `
<script>
function resolve() {
  document.body.removeAttribute('unresolved');
}

if (document.readyState === 'interactive' || document.readyState === 'complete') {
  resolve();
} else {
  window.addEventListener('DOMContentLoaded', resolve);
}
</script>
`
  ],
]);
