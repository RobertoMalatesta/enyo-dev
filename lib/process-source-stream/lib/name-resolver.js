'use strict';

var
	path = require('path');

var
	defined = require('defined');


module.exports = function (entry, options) {
	var name, ext;
	// @todo Ensure that this covers scenarios matched on windows platforms for self referencing
	// entries, most likely from an initial entry point
	if (entry.path == '' || entry.path == '.' || entry.path == './') {
		name = defined(entry.base, options.cwd);
	} else if (entry.path.charAt(0) == '.') {
		name = path.join(defined(entry.base, options.cwd), entry.path);
	} else {
		name = entry.path;
		entry.external = true;
	}
	ext = path.extname(name);
	if (ext) name = name.slice(0, -(ext.length));
	return name;
};