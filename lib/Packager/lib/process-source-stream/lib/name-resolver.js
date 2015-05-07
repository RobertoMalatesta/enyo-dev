'use strict';

var
	path = require('path');

var
	defined = require('defined');


module.exports = function (entry, options) {
	var name, ext, char = entry.path.charAt(0);
	// @todo Ensure that this covers scenarios matched on windows platforms for self referencing
	// entries, most likely from an initial entry point
	if (entry.path == '' || entry.path == '.' || entry.path == './') {
		name = defined(entry.base, options.cwd);
	} else if (char == '.') {
		name = path.join(defined(entry.base, options.cwd), entry.path);
	} else if (char == '/') {
		name = entry.path;
	} else {
		name = entry.path;
		entry.external = true;
	}
	ext = path.extname(name);
	if (ext) name = name.slice(0, -(ext.length));
	if (entry.external && entry.lib && name.charAt(0) == '/') {
		var rel = path.relative(entry.lib, name);
		rel = rel.split('/');
		rel.shift();
		ext = entry.lib.split('/').pop();
		name = ext + '/' + rel.join('/');
	}
	return name;
};