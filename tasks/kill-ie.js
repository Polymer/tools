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
	/**
	 * Kill all leftover iexplore.exe processes.
	 */
	grunt.registerTask('kill-ie', 'Kill all leftover iexplore.exe processes', function() {
		var os = require('os').type();
		if (os === 'Windows_NT') {
			var exec = require('child_process').exec;
			exec(process.env.comspec + ' /c taskkill.exe /F /IM iexplore.exe /T');
		}
	});
};