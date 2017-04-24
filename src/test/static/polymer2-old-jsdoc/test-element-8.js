/**
 * This element is a member of Polymer namespace and is registered with its
 * namespaced name.
 * @memberof Polymer
 */
class TestElementOne extends Polymer.Element {
  static get properties() {
    return {
      foo: {
        notify: true,
        type: String,
      }
    };
  }
}
Polymer.TestElementOne = TestElementOne;
window.customElements.define('test-element-one', Polymer.TestElementOne);

/**
 * This element is a member of Polymer namespace and is registered without its
 * namespaced name.
 * @memberof Polymer
 */
class TestElementTwo extends Polymer.Element {
  static get properties() {
    return {
      foo: {
        notify: true,
        type: String,
      }
    };
  }
}
Polymer.TestElementTwo = TestElementTwo;
window.customElements.define('test-element-two', TestElementTwo);