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
  ddd: function() {

  },
  /**
   * eee
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

};


/**
 * hhh
 * @memberof Polymer
 */
var hhh = function() {

};
Polymer.hhh = hhh;