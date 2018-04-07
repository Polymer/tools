/**
 * @polymer
 * @mixinFunction
 * @memberof Polymer
 */
Polymer.TestMixin = (superclass) => class extends superclass {
  static get properties() {
    return {
      foo: {
        notify: true,
        type: String,
      }
    };
  }
}
