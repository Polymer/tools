/**
 * @polymerMixin
 * @memberof Polymer
 */
let TestMixin;

function Foo(superclass) {
  return class extends superclass {
    static get properties() {
      return {
        foo: {
          notify: true,
          type: String,
        },
      };
    }
  }
}
