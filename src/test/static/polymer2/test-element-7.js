/**
 * @polymerElement
 * @extends Polymer.Element
 */
class BaseElement extends Polymer.Element {
  static get config() {
    return {
      properties: {
        one: {
          type: String,
        },
        two: {
          type: String,
        },
      },
    };
  }
}

/**
 * @polymerMixin
 */
const Mixin = (superclass) => class extends superclass {
  static get config() {
    return {
      properties: {
        two: {
          type: number,
        },
        three: {
          type: number,
        },
        four: {
          type: number,
        },
      },
    };
  }
}

/**
 * @polymerElement
 * @extends BaseElement
 * @mixes Mixin
 */
class SubElement extends BaseElement {
  static get is() {
    return 'sub-element';
  }
  static get config() {
    return {
      properties: {
        four: {
          type: Boolean,
        },
        five: {
          type: Boolean,
        },
      },
    };
  }
}
