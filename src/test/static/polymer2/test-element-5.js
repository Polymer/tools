/**
 * @customElement
 * @polymer
 */
class TestElement extends Polymer.Element {
  static get observedAttributes() {
    return ['a', 'b'];
  }

  static get properties() {
    return {
      foo: {
        type: String,
      },
    };
  }
}

customElements.define('test-element', TestElement);
