/**
 * @customElement
 * @polymer
 * @extends Polymer.Element
 * @appliesMixin Mixin2
 * @appliesMixin Mixin1
 */
class TestElement extends Mixin1
(Mixin2(Polymer.Element)) {
  static get is() {
    return 'test-element';
  }
}
