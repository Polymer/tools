/**
 * @polymer
 * @mixinFunction
 */
function someMixin() {
}

/** @constructor */
const hasConstructorAnnotation = HTMLElement;

/**
 * @constructor
 * @extends {HTMLElement}
 * @appliesMixin someMixin
 */
const hasConstructorExtendsMixinAnnotations = someMixin(HTMLElement);

/**
 * @private
 * @constructor
 * @extends {HTMLElement}
 * @appliesMixin someMixin
 */
const ephemeralSuperclass1 = someMixin(HTMLElement);
class hasEphemeralSuperclass1 extends ephemeralSuperclass1 {}

/**
 * @constructor
 * @private
 */
const ephemeralSuperclass2 = class {};
class hasEphemeralSuperclass2 extends ephemeralSuperclass2 {};

/**
 * @constructor
 * @private
 */
Polymer.notEphemeralSuperclass = class {};
class hasNotEphemeralSuperclass extends Polymer.notEphemeralSuperclass {};
