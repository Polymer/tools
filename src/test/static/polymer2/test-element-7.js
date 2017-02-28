/**
 * @polymerElement
 * @extends Polymer.Element
 */
class BaseElement extends Polymer.Element {
  static get properties() {
    return {
      one: {
        type: String,
      },
      two: {
        type: String,
      },
    };
  }
  customMethodOnBaseElement() {
    return 'foo';
  }
}

/**
 * @polymerMixin
 */
const Mixin = (superclass) => class extends superclass {
  static get properties() {
    return {
      two: {
        type: number,
      },
      three: {
        type: number,
      },
      four: {
        type: number,
      },
    };
  }
  customMethodOnMixin() {
    return 'bar';
  }
}

/**
 * @polymerElement
 * @extends BaseElement
 * @mixes Mixin
 */
class SubElement extends Mixin
(BaseElement) {
  static get is() {
    return 'sub-element';
  }
  static get properties() {
    return {
      four: {
        type: Boolean,
      },
      five: {
        type: Boolean,
      },
    };
  }
  customMethodOnSubElement() {
    return 'baz';
  }
}
