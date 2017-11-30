import('./submodule.js').then((submodule) => {
  console.log(submodule.subThing);
});

import('names/not/supported/yet').then((importByName) => {
  console.log('you know this is not supported yet');
});

const someString = './module.js';
import(someString).then((someModule) => {
  console.log('this is conceivably statically analyzable, but we do not do this yet');
});
