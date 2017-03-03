/**
 * @polymerMixin
 * @memberof Polymer
 */
const TestMixin = function(superclass) {
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
 * @polymerMixin
 * @memberof Polymer
 */
const _ProtectedMixin = function(superclass) {
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
 * @polymerMixin
 * @memberof Polymer
 * @private
 */
const InternalMixin = function(superclass) {
  return class extends superclass {
    frob(a, b) {
    }

    static glob() {
    }
  }
}
