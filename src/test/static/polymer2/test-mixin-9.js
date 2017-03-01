/**
 * A mixin description
 * @summary A mixin summary
 * @polymerMixin
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

    static get customClassGetter() {
      return 1;
    }

    get customInstanceGetter() {
      return 2;
    }

    static customClassFunction() {
      return 3;
    }

    customInstanceFunction() {
      return 4;
    }

    /**
   * This is the description for customInstanceFunctionWithJSDoc.
   * @returns {Number} - The number 5, always.
   */
    customInstanceFunctionWithJSDoc() {
      return 5;
    }

    customInstanceFunctionWithParams(a, b, c) {
      return 6;
    }

    /**
   * This is the description for customInstanceFunctionWithJSDoc.
   * @param {Number} a The first argument
   * @param {Number} b
   * @param {Number} c The third argument
   * @returns {Number} - The number 7, always.
   */
    customInstanceFunctionWithParamsAndJSDoc(a, b, c) {
      return 7;
    }

    /**
     * This is the description for
     * customInstanceFunctionWithParamsAndPrivateJSDoc.
     * @private
     */
    customInstanceFunctionWithParamsAndPrivateJSDoc() {
      return 8;
    }
  }
}
