class TestElement extends Polymer.Element {
  static get properties() {
    return {
      prop1: {
        type: String
      },
      prop2: {
        type: String
      }
    }
  }

  static get observers() {
    return [
      '_testObserver(prop1,' +
        '' + ' ' +
        'prop2)',
      `_testObserverTwo(prop1, ${'prop2'})`
    ];
  }
}

window.customElements.define('test-element', TestElement);
