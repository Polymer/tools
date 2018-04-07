/**
 * @polymer
 * @mixinFunction
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
 * @polymer
 * @mixinFunction
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
 * @polymer
 * @mixinFunction
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

/**
 * @polymer
 * @mixinFunction
 * @appliesMixin Polymer.InternalMixin
 * @memberof Polymer
 */
const MetaMixin = function(superclass) {
  return class extends InternalMixin(superclass) {
    static get properties() {
      return {
        meta: {
          type: Boolean,
        },
      };
    }
  }
}
