/**
 * @polymer
 * @mixinFunction
 */
function someMixin() {
}

/** @class */
const hasClassAnnotation = HTMLElement;

/** @constructor */
const hasConstructorAnnotation = HTMLElement;

/**
 * @class
 * @extends {HTMLElement}
 * @appliesMixin someMixin
 */
const hasClassExtendsMixinAnnotations = someMixin(HTMLElement);
