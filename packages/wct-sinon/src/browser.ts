import {applyExtensions, extendInterfaces} from 'wct-mocha/lib/mocha/extend';

import {replace} from './replace';
import {stub} from './stub';

extendInterfaces('replace', replace);
extendInterfaces('stub', stub);
applyExtensions();