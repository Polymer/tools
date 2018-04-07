/**
 * @customElement
 * @polymer
 * @extends Polymer.Element
 */
class BaseElement extends Polymer.Element {}

/**
 * @polymer
 * @mixinFunction
 */
const Mixin = (superclass) => class extends superclass {}

/**
 * @customElement
 * @polymer
 * @extends BaseElement
 * @appliesMixin Mixin
 */
const SubElement = Mixin(BaseElement);

/**
 * @customElement
 * @polymer
 * @extends BaseElement
 * @appliesMixin Mixin
 */
const SubElement2 = class extends Mixin
(BaseElement) {
}

/**
 * @customElement
 * @polymer
 * @appliesMixin MyMixin */
window.MyElement = class extends MixedElement { }
