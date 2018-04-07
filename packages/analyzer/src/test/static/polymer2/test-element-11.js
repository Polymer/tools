
class MyElement extends Polymer.Element {
  static get is() { return 'my-app'; }
  static get properties() {
    return {
      prop1: {
        type: String,
        value: 'my-app'
      }
    };
  }
}

window.customElements.define(MyElement.is, MyElement);
