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

/**
 * I am a description of test-element.
 *
 * @hero /path/to/hero.png
 * @demo
 * @demo /demo/index.php I am a php demo
 * @demo /demo/no_desc.html
 */
Polymer({

  is: 'test-element',

  /**
   * Fired when properties on `data` are added, removed, or modified.
   *
   * @event data-change
   */

  /**
   * Fired when an error occurs on an interaction with Firebase.  The
   * `details.error` property contains the `Error` object provided by
   * the Firebase API.
   *
   * @event error
   */

  properties: {
    /**
     * I am a string!
     */
    stringProp: String,
    /**
     * I am a number!
     */
    numProp: Number,
    /**
     * I am an object!
     */
    objectProp: Object,
    /**
     * I am an object with explicit type!
     * @type HTMLElement
     */
    elementProp: Object,
    /**
     * I am an object with notify=true!
     */
    objectNotify: {
      type: Object,
      notify: true
    },
    /**
     * I am an object with notify=!0
     */
    objectNotifyUnary: {
      type: Object,
      notify: !0
    },
    /**
     * I am a boolean property!
     */
    boolProp: Boolean
  },

  bind: {
    numProp: 'numChanged',
    elementProp: 'elemChanged'
  },

  numChanged: function() {

  },

  elemChanged: function() {

  }

});
