/**
 * Ignore me because I have no annotation to hint that I'm in a public API.
 */
function ignoreFn() { }

/**
 * I'm explicitly global.
 * @global
 */
function globalFn() { }

/**
 * I'm in a namespace, so I'm probably part of a public API.
 * @memberof SomeNamespace
 */
function memberofFn() { }

/**
 * My @function annotation overrides my name.
 * @global
 * @function overrideNameFn
 */
function wrongNameFn() { }
