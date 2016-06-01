'use strict';
class A {
  constructor() {
    super();
  }

  beforeRegister() {
    this.is = 'test-seed';

    /**
     * Fired.
     *
     * Test
     *
     * @event fired-event {{item: Object}} detail -
     *     item: An object.
     */
    this.properties = {
      /**
       * The data.
       * @type string
       */
      data: {
        type: 'String',
        notify: true,
      },
    }

    this.observers = [
      '_observer1(string)',
      '_observer2(string)',
    ]
  }

  get behaviors() {
    return [
      Behavior1,
      Behavior2,
    ];
  }

  /**
   * Test comment.
   * @param {string=} string Optional string
   */
  test(string) {
    this.data = 'Hello World';
  }
}

Polymer(A);
