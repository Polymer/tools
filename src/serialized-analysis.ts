export interface SerializedAnalysis { packages: Package[]; }

export interface Package {
  /** The name of the package, like `paper-button` */
  name: string;
  /** The version, extracted from package.json, bower.json, etc as available. */
  version: string;

  /** The npm metadata of the package, if any. */
  npmPackage?: NpmPackage;

  /** The bower metadata of the package, if any. */
  bowerMetadata?: BowerMetadata;

  /** Elements found inside the package. */
  elements: Element[];
}

export interface Element {
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
   * Paths, relative to `this.path` to demo pages for the element.
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
  classname: string;

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
  'slots': Slot[];

  /** Information useful for styling the element and its children. */
  styling: {

    /** CSS Classes that produce built-in custom styling for the element. */
    classes: {
      /** The name of the class. e.g. `bright`, `cascade`, `ominous_pulsing` */
      name: string;
      /** A markdown description of the class and what effects it has. */
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

  /**
   * An extension point for framework-specific metadata, as well as any
   * metadata not yet standardized here such as what polyfills are needed,
   * behaviors and mixins used, the framework that the element was written in,
   * tags/categories, links to specs that the element implements, etc.
   */
  metadata: Object;
}

export interface Attribute {
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

  /** The default value of the attribute, if any. */
  defaultValue?: string;
}

export interface Property {
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

  /** A string representation of the default value. */
  defaultValue?: string;

  /** Nested subproperties hanging off of this property. */
  properties?: Property[];

  /**
   * An extension point for framework-specific metadata, as well as any
   * metadata not yet standardized here such as associated events and
   * observers.
   */
  metadata?: Object;
}

export interface Event {
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
}

export interface Slot {
  /** The name of the slot. e.g. `banner`, `body`, `tooltipContents` */
  name: string;

  /** A markdown description of the slot. */
  description: string;

  // Something about fallback perhaps?
}

export interface NpmPackage {
  name: string;
  version: string;
  description?: string;
  // ... etc
}

export interface BowerMetadata {
  name: string;
  version: string;
  description?: string;
  // ... etc
}

// An example, the correct compilation thereof acts as a test.
// TODO(rictic): once the tests are typescript, move this there.
const paperButtonElement: Element = {
  path: 'paper-button.html',
  tagname: 'paper-button',
  classname: 'PaperButton',
  superclass: 'HTMLElement',
  demos: ['demo/index.html'],

  attributes: [
    {
      name: 'raised',
      description: 'If true, the button should be styled with a shadow.',
      type: 'boolean',
    },
    {
      name: 'elevation',
      type: 'number',
      description: `
  The z-depth of this element, from 0-5. Setting to 0 will remove the
  shadow, and each increasing number greater than 0 will be "deeper"
  than the last.`.trim()
    },
    {name: 'role', defaultValue: 'button'},
    {name: 'tabindex', defaultValue: '0'},
    {name: 'animated', defaultValue: 'true'}
  ],
  properties: [
    {
      name: 'raised',
      description: 'If true, the button should be styled with a shadow.',
      type: 'boolean',
      defaultValue: 'false',
      metadata: {
        polymer: {reflectToAttribute: true, observer: '_calculateElevation'}
      }
    },
    {
      name: 'elevation',
      type: 'number',
      description: `
  The z-depth of this element, from 0-5. Setting to 0 will remove the
  shadow, and each increasing number greater than 0 will be "deeper"
  than the last.`.trim(),
      defaultValue: '1',
      metadata: {polymer: {reflectToAttribute: true, readOnly: true}}
    }
  ],
  events: [{
    name: 'transitionend',
    type: 'Event',
    description: `
Fired when the animation finishes.
This is useful if you want to wait until
the ripple animation finishes to perform some action.`.trim(),
    detail: {
      properties: [{
        name: 'node',
        description: 'Contains the animated node.',
        type: 'Object'
      }]
    }
  }],
  slots: [{name: '', description: 'The body of the button.'}],
  styling: {
    classes: [],
    cssVariables: [
      {
        name: '--paper-button-ink-color',
        description: 'Background color of the ripple',
        fallbackBehavior: 'Based on the button\'s color'
      },
      {
        name: '--paper-button',
        description: 'Mixin applied to the disabled button. Note that you ' +
            'can also use the `paper-button[disabled]` selector',
        fallbackBehavior: '{}'
      },
      {
        name: '--paper-button-disabled',
        description: '',
        fallbackBehavior: '{}'
      },
      {
        name: '--paper-button-flat-keyboard-focus',
        description: 'Mixin applied to a flat button after ' +
            'it\'s been focused using the keyboard',
        fallbackBehavior: '{}'
      },
      {
        name: '--paper-button-raised-keyboard-focus',
        description: 'Mixin applied to a raised button ' +
            'after it\'s been focused using the keyboard',
        fallbackBehavior: '{}'
      },
      {name: '--layout-inline'},
      {name: '--layout-center-center'},
      {name: '--paper-font-common-base'},
    ],

    needsExplicitSize: false
  },
  metadata: {polymer: {behaviors: ['Polymer.PaperButtonBehavior']}},
  description: `
Material design: [Buttons](https://www.google.com/design/spec/components/buttons.html)

\`paper-button\` is a button. When the user touches the button, a ripple effect emanates
from the point of contact. It may be flat or raised. A raised button is styled with a
shadow.

Example:

    <paper-button>Flat button</paper-button>
    <paper-button raised>Raised button</paper-button>
    <paper-button noink>No ripple effect</paper-button>
    <paper-button toggles>Toggle-able button</paper-button>

A button that has \`toggles\` true will remain \`active\` after being clicked (and
will have an \`active\` attribute set). For more information, see the \`Polymer.IronButtonState\`
behavior.

You may use custom DOM in the button body to create a variety of buttons. For example, to
create a button with an icon and some text:

    <paper-button>
      <iron-icon icon="favorite"></iron-icon>
      custom button content
    </paper-button>

To use \`paper-button\` as a link, wrap it in an anchor tag. Since \`paper-button\` will already
receive focus, you may want to prevent the anchor tag from receiving focus as well by setting
its tabindex to -1.

    <a href="https://www.polymer-project.org/" tabindex="-1">
      <paper-button raised>Polymer Project</paper-button>
    </a>

### Styling

Style the button with CSS as you would a normal DOM element.

    paper-button.fancy {
      background: green;
      color: yellow;
    }

    paper-button.fancy:hover {
      background: lime;
    }

    paper-button[disabled],
    paper-button[toggles][active] {
      background: red;
    }

By default, the ripple is the same color as the foreground at 25% opacity. You may
customize the color using the \`--paper-button-ink-color\` custom property.

The following custom properties and mixins are also available for styling:

Custom property | Description | Default
----------------|-------------|----------
\`--paper-button-ink-color\` | Background color of the ripple | \`Based on the button's color\`
\`--paper-button\` | Mixin applied to the button | \`{}\`
\`--paper-button-disabled\` | Mixin applied to the disabled button. Note that you can also use the \`paper-button[disabled]\` selector | \`{}\`
\`--paper-button-flat-keyboard-focus\` | Mixin applied to a flat button after it's been focused using the keyboard | \`{}\`
\`--paper-button-raised-keyboard-focus\` | Mixin applied to a raised button after it's been focused using the keyboard | \`{}\`

@demo demo/index.html
`.trim()

};

const paperButton: SerializedAnalysis = {
  packages: [{
    name: 'paper-button',
    version: '1.0.12',
    bowerMetadata: <BowerMetadata>{
      'name': 'paper-button',
      'version': '1.0.12',
      'description': 'Material design button',
      'authors': ['The Polymer Authors'],
      'keywords':
          ['web-components', 'web-component', 'polymer', 'paper', 'button'],
      'main': 'paper-button.html',
      'private': true,
      'repository': {
        'type': 'git',
        'url': 'git://github.com/PolymerElements/paper-button.git'
      },
      'license': 'http://polymer.github.io/LICENSE.txt',
      'homepage': 'https://github.com/PolymerElements/paper-button',
      'dependencies': {
        'polymer': 'Polymer/polymer#^1.1.0',
        'iron-flex-layout': 'PolymerElements/iron-flex-layout#^1.0.0',
        'paper-behaviors': 'PolymerElements/paper-behaviors#^1.0.0',
        'paper-material': 'PolymerElements/paper-material#^1.0.0'
      },
      'devDependencies': {
        'iron-component-page': 'PolymerElements/iron-component-page#^1.0.0',
        'iron-demo-helpers': 'PolymerElements/iron-demo-helpers#^1.0.0',
        'iron-icon': 'PolymerElements/iron-icon#^1.0.0',
        'iron-icons': 'PolymerElements/iron-icons#^1.0.0',
        'iron-test-helpers': 'PolymerElements/iron-test-helpers#^1.0.0',
        'paper-styles': 'PolymerElements/paper-styles#^1.0.0',
        'test-fixture': 'PolymerElements/test-fixture#^1.0.0',
        'web-component-tester': '^4.0.0',
        'webcomponentsjs': 'webcomponents/webcomponentsjs#^0.7.0'
      },
      'ignore': []
    },
    elements: [paperButtonElement]
  }],
};
