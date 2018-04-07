/**
 * @polymerElement
 * @extends Polymer.Element
 * @mixes Mixin2
 * @mixes Mixin1
 */
class TestElement extends Mixin1
(Mixin2(Polymer.Element)) {
  static get is() {
    return 'test-element';
  }
}
