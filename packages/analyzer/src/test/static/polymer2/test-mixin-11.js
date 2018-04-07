/**
 * @polymer
 * @mixinFunction
 */
function TestMixin(superclass) {
  return class extends superclass {
    static get properties() {
      return {
        foo: {
          notify: true,
          type: String,
        },
      };
    }

    constructor() {
      super();

      /** @public This description is in the constructor. */
      this.foo;

      /** @type {number} This property is defined only in the constructor. */
      this.constructorProp = 10;
    }
  }
}
