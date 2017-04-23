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
      },
    };
  }
}

/**
 * @customElement
 * @polymer
 * @extends BaseElement
 */
class SubElement extends BaseElement {
  static get is() {
    return 'sub-element';
  }
  static get properties() {
    return {
      bar: {
        notify: true,
        type: String,
      },
    };
  }
}
