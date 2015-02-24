(function(context){
  "use strict";
  var jsParse = require('./jsParse');
  var importParse = require('./importParse');
  function reduceMetadata(m1, m2) {
    return {
      elements: m1.elements.concat(m2.elements),
      modules: m1.modules.concat(m2.modules)
    };
  }

  var hydrolyze = function hydrolyze(htmlImport) {
    var parsed = importParse(htmlImport);
    var metadata = [];
    var external_scripts = [];
    for (var i = 0; i < parsed.script.length; i++) {
      var script = parsed.script[i];
      var inline = true;
      var src;
      // Check for inline script.
      for (var j = 0; j < script.attrs.length; j++) {
        var attr = script.attrs[i];
        if (attr.name == "src") {
          inline = false;
          src = attr.value;
        }
      }
      var parsedJs;
      if (inline) {
        parsedJs = hyd.jsParse(script.childNodes[0].value);
        metadata.push(parsedJs);
      } else {
        external_scripts.push(src);
      }
    }
    metadata = metadata.reduce(reduceMetadata);
    metadata.external_scripts = external_scripts;
    metadata.html = parsed;
    return metadata;
  };

  context.exports = hydrolyze;
}(module));