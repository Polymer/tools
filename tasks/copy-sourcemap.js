/*
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

module.exports = function(grunt) {
  grunt.registerTask('sourcemap_copy', 'Copy sourcesContent between sourcemaps', function(source, dest) {
    var sourceMap = grunt.file.readJSON(source);
    var destMap = grunt.file.readJSON(dest);
    destMap.sourcesContent = [];
    var ssources = sourceMap.sources;
    // uglify may reorder sources, make sure sourcesContent matches new order
    destMap.sources.forEach(function(source) {
      var j = ssources.indexOf(source);
      destMap.sourcesContent.push(sourceMap.sourcesContent[j]);
    });
    grunt.file.write(dest, JSON.stringify(destMap));
  });
};
