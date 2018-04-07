/**
 *
 */
class TestElement extends HTMLElement {
  static get observedAttributes() {
    return ['a', 'b'];
  }
}

customElements.define('test-element', TestElement);
