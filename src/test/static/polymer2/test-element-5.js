/**
 * @polymerElement
 */
class TestElement extends Polymer.Element {
  static get observedAttributes() {
    return ['a', 'b'];
  }

  static get config() {
    return {
      properties: {
        foo: {
          type: String,
        },
      },
    };
  }
}

customElements.define('test-element', TestElement);
