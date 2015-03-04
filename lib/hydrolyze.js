(function(context){
  "use strict";

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
  var hydrolyze = function hydrolyze(htmlImport, attachAST, href, loader, resolved) {
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
    var metadata = [];
    var metadata_promises = [];
    var external_scripts = [];
    for (var i = 0; i < parsed.script.length; i++) {
      var script = parsed.script[i];
      var inline = true;
      var src;
      // Check for inline script.
      for (var j = 0; j < script.attrs.length; j++) {
        var attr = script.attrs[j];
        if (attr.name == "src") {
          inline = false;
          src = attr.value;
        }
      }
      var parsedJs;
      if (inline) {
        metadata_promises.push(Promise.resolve(jsParse(script.childNodes[0].value, attachAST)));
      } else {
        if (loader) {
          var resolvedUrl = url.resolve(href, src);
          var promise = loader.request(resolvedUrl).then(function(content){
            return jsParse(content);
          });
          metadata_promises.push(promise);
        }
        external_scripts.push(src);
      }
    }

    var promise = Promise.all(metadata_promises).then(function(values) {
      metadata = values.reduce(reduceMetadata);
      metadata.url = href;
      metadata.external_scripts = external_scripts;
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
      parsed.import.forEach(function(link) {
        var linkurl;
        for (var i = 0; i < link.attrs.length; i++) {
          var attr = link.attrs[i];
          if (attr.name == "href") {
            linkurl = attr.value;
            break;
          }
        }
        if (linkurl) {
          var resolvedUrl = url.resolve(href, linkurl);
          importPromises.push(loader.request(resolvedUrl).then(function(content){
            return hydrolyze(content, attachAST, resolvedUrl, loader, resolved);
          }));
        }
      });
      promise = Promise.all(importPromises).then(function (imports) {
        var m = imports.shift();
        m.imports = imports.reverse();
        return m;
      })
    }
    return promise;
  };


  context.exports = hydrolyze;
}(module));
