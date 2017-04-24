class TestElement extends Polymer.Element {
  static get properties() {
    return {
      /**
       * The foo prop.
       * @public
       * @type {m-test|function}
       */
      foo: {
        notify: true,
        type: String,
      }
    }
  }
}

window.customElements.define('test-element', TestElement);

/**
 * A very basic element
 * @summary A basic element
 * @polymerElement
 */
class BaseElement extends Polymer.Element {
  static get properties() {
    return {
      /** A base foo element. */
      foo: {
        notify: true,
        type: String,
      },
    };
  }
}
