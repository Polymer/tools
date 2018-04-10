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

import * as dom5 from 'dom5/lib/index-next';

const p = dom5.predicates;

export const isTemplate = p.hasTagName('template');
export const isTemplateDescendant = p.parentMatches(isTemplate);

export const isDatabindingTemplate = p.AND(
    isTemplate,
    p.OR(
        p.hasAttrValue('is', 'dom-bind'),
        p.hasAttrValue('is', 'dom-if'),
        p.hasAttrValue('is', 'dom-repeat'),
        p.hasAttrValue('is', 'dom-bind'),
        p.parentMatches(p.OR(
            p.hasTagName('dom-module'),

            p.hasTagName('dom-bind'),
            p.hasTagName('dom-if'),
            p.hasTagName('dom-repeat'),
            p.hasTagName('dom-bind')))));
