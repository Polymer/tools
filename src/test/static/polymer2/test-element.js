class TestElement extends Polymer.Element {
  static get config() {
    return {
      properties: {
        foo: {
          notify: true,
          type: String,
        }
      },
    };
  }
}

window.customElements.define('test-element', TestElement);

/**
 * @polymerElement
 */
class BaseElement extends Polymer.Element {
  static get config() {
    return {
      properties: {
        foo: {
          notify: true,
          type: String,
        }
      },
    };
  }
}
