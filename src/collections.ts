/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import './rules';

import {registry} from './registry';
import {RuleCollection} from './rule';

registry.register(
    new RuleCollection('polymer-2', `Rules for projects that use Polymer 2.x`, [
      'dom-module-invalid-attrs',
      'style-into-template',
      'undefined-elements',
      'unbalanced-polymer-delimiters',
      'set-unknown-attribute',
      'behaviors-spelling',
    ]));

registry.register(new RuleCollection(
    'polymer-2-hybrid',
    `Rules for projects that are compatible with either Polymer 1.x or 2.x

Will warn about use of deprecated Polymer 1.x features or brand new features in Polymer 2.x`,
    [
      'dom-module-invalid-attrs',
      'style-into-template',
      'undefined-elements',
      'unbalanced-polymer-delimiters',
      'set-unknown-attribute',
      'behaviors-spelling',
    ]));

registry.register(new RuleCollection(
    'polymer-1',
    `Rules for projects that use Polymer 1.x.

For projects that are ready to start transitioning to Polymer 2.0 see polymer-2-hybrid.
`,
    [
      'undefined-elements',
      'unbalanced-polymer-delimiters',
      'set-unknown-attribute',
      'behaviors-spelling',
    ]));
