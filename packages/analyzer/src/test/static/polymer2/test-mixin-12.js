/**
 * A mixin description
 * @polymer
 * @mixinFunction
 */
export function TestMixin(superclass) {
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

/**
 * Another mixin description
 * @polymer
 * @mixinFunction
 */
export default function DefaultTestMixin(superclass) {
  return class extends superclass {
    static get properties() {
      return {
        bar: {
          type: Boolean,
        },
      };
    }
  }
}
