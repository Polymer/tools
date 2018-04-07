import('./submodule.js');
import('test-package');

// This is conceivably statically analyzable, but we do not do this yet
const someString = './module.js';
import(someString);
