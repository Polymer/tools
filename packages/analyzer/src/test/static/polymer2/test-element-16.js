class TestElement extends Polymer.Element {
  static get properties() {
    return {
      foo: {
        notify: true,
        type: String,
      }
    }
  }

  constructor() {
    super();

    /** @protected This description lives in the constructor. */
    this.foo = 'bar';

    /**
     * @type {number} This is a private field on the element.
     * @const
     */
    this.constructorOnly_;
  }
}

window.customElements.define('test-element', TestElement);
