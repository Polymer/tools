/**
 * @polymerElement
 * @extends Polymer.Element
 */
class BaseElement extends Polymer.Element {}

/**
 * @polymerMixin
 */
const Mixin = (superclass) => class extends superclass {}

/**
 * @polymerElement
 * @extends BaseElement
 * @mixes Mixin
 */
const SubElement = Mixin(BaseElement);

/**
 * @polymerElement
 * @extends BaseElement
 * @mixes Mixin
 */
const SubElement2 = class extends Mixin
(BaseElement) {
}