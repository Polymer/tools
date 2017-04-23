/**
 * @customElement
 * @polymer
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

  /** documented so public */
  customMethodOnBaseElement() {
    return 'foo';
  }
}

/**
 * @mixinFunction
 * @polymer
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
  /** documented so public */
  customMethodOnMixin() {
    return 'bar';
  }
}

/**
 * @customElement
 * @polymer
 * @extends BaseElement
 * @appliesMixin Mixin
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
