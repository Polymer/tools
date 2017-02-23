/**
 * @polymerElement
 * @extends Polymer.Element
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

/**
 * @polymerElement
 * @extends BaseElement
 */
class SubElement extends BaseElement {
  static get is() {
    return 'sub-element';
  }
  static get config() {
    return {
      properties: {
        bar: {
          notify: true,
          type: String,
        }
      },
    };
  }
}
