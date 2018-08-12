export class ClassA1 {}

class ClassA2 {}
export {ClassA2}

export {ClassB1, ClassC2Alias as ClassC2Alias2} from './module-b.js';
export * from './module-b.js';

export const notASupportedAnalyzerFeature = 0;
export {NotResolvable} from './module-b.js';

import {PrivateClass} from './module-b.js';

/**
 * @param {!AutoImportClass1} p
 * @return {!AutoImportClass2}
 */
export function autoImportFunction(p) { }
