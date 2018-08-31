/**
 * stub
 *
 * The stub addon allows the tester to partially replace the implementation of
 * an element with some custom implementation. Usage example:
 *
 * beforeEach(function() {
 *   stub('x-foo', {
 *     attached: function() {
 *       // Custom implementation of the `attached` method of element `x-foo`..
 *     },
 *     otherMethod: function() {
 *       // More custom implementation..
 *     },
 *     getterSetterProperty: {
 *       get: function() {
 *         // Custom getter implementation..
 *       },
 *       set: function() {
 *         // Custom setter implementation..
 *       }
 *     },
 *     // etc..
 *   });
 * });
 */
export declare function stub(_context: any, teardown: Function): (tagName: string, implementation: object) => void;
