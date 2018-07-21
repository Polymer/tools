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
