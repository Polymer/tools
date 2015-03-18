/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';

// jshint -W079
// Promise polyfill
var Promise = global.Promise || require('es6-promise').Promise;
var Map = global.Map || require('es6-map');
//jshint +W079

var jsParse = require('./ast-utils/js-parse');
var importParse = require('./ast-utils/import-parse');
var url = require('url');
function reduceMetadata(m1, m2) {
  return {
    elements: m1.elements.concat(m2.elements),
    modules: m1.modules.concat(m2.modules)
  };
}

/**
* Returns a metadata representation of `htmlImport`.
* @param  {String} htmlImport The raw text to process.
* @param  {[type]} attachAST  Whether elements should include their parse5 AST.
* @param  {[type]} href       The URL of this element.
* @param  {[type]} loader     A loader to load external resources. Without
*                             the `href` argument, this will fail.
* @param  {[type]} resolved   A `Map` containing all already resolved imports.
* @return {Object}            The hydrolyzed import.
*/
var hydrolyze = function hydrolyze(htmlImport,
                                   attachAST,
                                   href,
                                   loader,
                                   resolved) {
  if (resolved === undefined) {
    resolved = new Map();
  } else {
    if (resolved.has(href)) {
      return Promise.resolve({});
    }
  }
  resolved.set(href, true);
  if (attachAST === undefined) {
    attachAST = false;
  }
  var parsed = importParse(htmlImport);
  var metadataPromises = [];
  var externalScripts = [];
  for (var i = 0; i < parsed.script.length; i++) {
    var script = parsed.script[i];
    var inline = true;
    var src;
    // Check for inline script.
    for (var j = 0; j < script.attrs.length; j++) {
      var attr = script.attrs[j];
      if (attr.name == 'src') {
        inline = false;
        src = attr.value;
      }
    }
    var parsedJs;
    if (inline) {
      metadataPromises.push(Promise.resolve(jsParse(script.childNodes[0].value,
                                                    attachAST)));
    } else {
      if (loader) {
        var resolvedUrl = url.resolve(href, src);
        var request = loader.request(resolvedUrl).then(jsParse);
        metadataPromises.push(request);
      }
      externalScripts.push(src);
    }
  }

  var promise = Promise.all(metadataPromises).then(function(values) {
    var metadata = {};
    if (values.length > 0) {
      metadata = values.reduce(reduceMetadata);
    }
    metadata.url = href;
    metadata.externalScripts = externalScripts;
    metadata.elements.forEach(attachDomModule.bind(null, parsed));
    if (attachAST) {
      metadata.html = parsed;
    }
    return metadata;
  });
  if (loader && parsed.import.length > 0) {
    promise = promise.then(function(metadata) {
      metadata.imports = [];
      return metadata;
    });
    var importPromises = [promise];
    parsed.import.reverse().forEach(function(link) {
      var linkurl;
      for (var i = 0; i < link.attrs.length; i++) {
        var attr = link.attrs[i];
        if (attr.name == 'href') {
          linkurl = attr.value;
          break;
        }
      }
      if (linkurl) {
        var resolvedUrl = url.resolve(href, linkurl);
        importPromises.push(importPromises[importPromises.length - 1].then(
            function() {
              return loader.request(resolvedUrl).then(function(content) {
                return hydrolyze(content,
                                 attachAST,
                                 resolvedUrl,
                                 loader,
                                 resolved);
              });
            }));
      }
    });
    promise = Promise.all(importPromises).then(function(imports) {
      var m = imports.shift();
      m.imports = imports;
      return m;
    });
  }
  return promise;
};

/**
 * Finds a <dom-module> associated with `element`, and stores it on the
 * `domModule` property of `element`. No-op if there is no <dom-module> that
 * matches.
 *
 * @param {Object} element
 * @param {Object} parsedImport
 */
function attachDomModule(parsedImport, element) {
  var domModules = parsedImport['dom-module'];
  for (var i = 0, domModule; i < domModules.length; i++) {
    domModule = domModules[i];
    if (getNodeAttribute(domModule, 'id') === element.is) {
      element.domModule = domModule;
      return;
    }
  }
}

// TODO(nevir): parse5-utils!
function getNodeAttribute(node, name) {
  for (var i = 0, attr; i < node.attrs.length; i++) {
    attr = node.attrs[i];
    if (attr.name === name) {
      return attr.value;
    }
  }
}

module.exports = hydrolyze;
