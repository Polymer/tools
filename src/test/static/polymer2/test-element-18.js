
class HelloWorld extends Polymer.Element {
  constructor() {
    super();
    class Foo {};
  }
  static get is() {return 'hello-world';}
};
customElements.define(HelloWorld.is, HelloWorld);