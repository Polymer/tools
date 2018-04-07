/**
 * aaa
 * @param {Number} a This is the first argument
 * @memberof Polymer
 */
function aaa(a) {
  return a;
}
Polymer.aaa = aaa;

/**
 * bbb
 * @memberof Polymer
 */
Polymer.bbb = function bbb() {

};

/**
 * someProp
 * @memberof Polymer
 */
Polymer.someProp = 123;


(() => {

  /**
   * ccc
   * @protected
   * @memberof Polymer
   */
  function ccc() {
  }
  Polymer.ccc = ccc;

})();


Polymer = {
  /**
   * ddd
   * @memberof Polymer
   */
  _ddd: function() {

  },
  /**
   * eee
   * @private
   * @memberof Polymer
   */
  eee: () => {},

  /**
   * fff
   * @memberof Polymer
   */
  fff() {

  },

  /**
   * ggg
   * @function
   * @memberof Polymer
   */
  ggg: someFunction,

  /**
   * hhh_ should be private
   * @function
   * @memberof Polymer
   */
  hhh_: someOtherFunc,

  /**
   * __iii should be private too
   * @memberof Polymer
   */
  __iii() { },
};


/**
 * jjj
 * @memberof Polymer
 */
var jjj = function() {

};
Polymer.jjj = jjj;
