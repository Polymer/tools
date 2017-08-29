/**
 * @customElement
 * @polymer
 * @extends Polymer.Element
 */
class BaseElement extends Polymer.Element {
  static get properties() {
    return {
      foo: {
        notify: true,
        type: String,
        reflectToAttribute: true,
        readOnly: true,
        value: 'foo'
      },
    };
  }
}
