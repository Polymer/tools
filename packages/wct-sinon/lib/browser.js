"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var extend_1 = require("wct-mocha/lib/mocha/extend");
var replace_1 = require("./replace");
var stub_1 = require("./stub");
extend_1.extendInterfaces('replace', replace_1.replace);
extend_1.extendInterfaces('stub', stub_1.stub);
extend_1.applyExtensions();
//# sourceMappingURL=browser.js.map