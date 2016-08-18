/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

/**
 * The base interface, holding properties common to many nodes.
 */
export interface Feature {
  /** Where this feature is defined in source code. */
  sourceRange?: SourceRange;

  /**
   * An extension point for framework-specific metadata, as well as any
   * metadata not yet standardized here such as what polyfills are needed,
   * behaviors and mixins used, the framework that the element was written in,
   * tags/categories, links to specs that the element implements, etc.
   *
   * Framework-specific metadata should be put into a sub-object with the name
   * of that framework.
   */
  metadata?: any;
}

export interface SourceRange {
  /**
   * Path to the file containing the definition of the feature,
   * relative to the parent feature, or the package if the feature has no parent
   * (e.g. elements).
   *
   * If blank, the feature is defined in the same file as its parent.
   */
  file?: string;
  /* The start of the feature. */
  start: Position;
  /* The end of the feature. */
  end: Position;
}

export interface Position {
  /** Line number, starting from zero. */
  line: number;
  /** Column offset within the line, starting from zero. */
  column: number;
}

export interface Elements {
  schema_version: string;
  // TODO(rictic): once this schema has stabilized, put the json file somewhere
  // and reference it like:
  // $schema: 'http://polymer-project.org/schema/v1/elements.json';
  elements: Element[];
}

export interface Element extends Feature {
  /**
   * The path, relative to the base directory of the package.
   *
   * e.g. `paper-input.html` or `app-toolbar/app-toolbar.html` (given that
   * app-toolbar lives in the app-layout package).
   */
  path: string;

  /** The tagname that the element registers itself as. e.g. `paper-input` */
  tagname: string;

  /** A markdown description for the element. */
  description: string;

  /**
   * Paths, relative to the base directory of the package, to demo pages for the
   * element.
   *
   * e.g. `['demos/index.html', 'demos/extended.html']`
   */
  demos: string[];

  /**
   * The tagname that the element extends, if any. The value of the `extends`
   * option that's passed into `customElements.define`.
   *
   * e.g. `input`, `paper-button`, `my-super-element`
   */
  extends?: string;

  /**
   * The class name for this element.
   *
   * e.g. `MyElement`, `Polymer.PaperInput`
   */
  classname?: string;

  /**
   * The class that this element extends.
   *
   * This is non-optional, as every custom element must have HTMLElement in
   * its prototype change.
   *
   * e.g. `HTMLElement`, `HTMLInputElement`, `MyNamespace.MyBaseElement`
   */
  superclass: string;

  /** The attributes that this element is known to understand. */
  attributes?: Attribute[];

  /** The properties that this element has. */
  properties?: Property[];

  /** The events that this element fires. */
  events?: Event[];

  /** The shadow dom content slots that this element accepts. */
  slots:
  Slot[];  // this formatting is strange, yes

  /** Information useful for styling the element and its children. */
  styling: {

    /** CSS selectors that the element recognizes on itself for styling. */
    selectors: {
      /** The CSS selector. e.g. `.bright`, `[height=5]`, `[cascade]`. */
      value: string;
      /**
       * A markdown description of the effect of this selector matching
       * on the element.
       */
      description: string;
    }[];

    /** CSS Variables that the element understands. */
    cssVariables: {

      /** The name of the variable. e.g. `--header-color`, `--my-element-size`*/
      name: string;

      /** The type of the variable. Advisory. e.g. `color`, `size` */
      type?: string;

      /** A markdown description of the variable. */
      description?: string;

      /**
       * A markdown description of how the element will fallback if the variable
       * isn't defined.
       */
      fallbackBehavior?: string;
    }[];

    /** If true, the element must be given an explicit size by its context. */
    needsExplicitSize?: boolean;

    // Would be nice to document the default styling a bit here, whether it's
    // display: block or inline or whatever.
  };
}

export interface Attribute extends Feature {
  /** The name of the attribute. e.g. `value`, `icon`, `should-collapse`. */
  name: string;

  /** A markdown description for the attribute. */
  description?: string;

  /**
   * The type that the attribute will be serialized/deserialized as.
   *
   * e.g. `string`, `number`, `boolean`, `RegExp`, `Array`, `Object`.
   */
  type?: string;

  /**
   * The default value of the attribute, if any.
   *
   * As attributes are always strings, this is the actual value, not a human
   * readable description.
   */
  defaultValue?: string;

  // We need some way of representing that this attribute is associated with a
  // property. TBD.
}

export interface Property extends Feature {
  /** The name of the property. e.g. `value`, `icon`, `shouldCollapse`. */
  name: string;

  /** A markdown description of the property. */
  description: string;

  /**
   * The javascript type of the property.
   *
   * There's no standard here. Common choices are closure compiler syntax
   * and typescript syntax.
   */
  type: string;

  /**
   * A string representation of the default value. Intended only to be human
   * readable, so may be a description, an identifier name, etc.
   */
  defaultValue?: string;

  /** Nested subproperties hanging off of this property. */
  properties?: Property[];
}

export interface Event extends Feature {
  /** The name of the event. */
  name: string;

  /** A markdown description of the event. */
  description: string;
  /**
   * The type of the event object that's fired.
   *
   * e.g. `Event`, `CustomEvent`, `KeyboardEvent`, `MyCustomEvent`.
   */
  type: string;

  /** Information about the `detail` field of the event. */
  detail?: {properties: Property[]};

  // Should we have a way of associating an event with an attribute or a
  // property?
}

export interface Slot extends Feature {
  /** The name of the slot. e.g. `banner`, `body`, `tooltipContents` */
  name: string;

  /** A markdown description of the slot. */
  description: string;

  // Something about fallback perhaps?
}
