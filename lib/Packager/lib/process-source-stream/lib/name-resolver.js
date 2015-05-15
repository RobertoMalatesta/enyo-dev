'use strict';

var
	path = require('path');

var
	defined = require('defined');


module.exports = function (entry, options, stream) {
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
		
		var
			lib = stream._fullpaths[entry.lib],
			md = lib && (lib.json.moduleDir || 'lib');
		
		// easiest case
		if (md) {
			name = path.join(entry.libName, path.relative(path.join(entry.lib, md), name));
		} else {
		
			// compare the differing paths from the lib to the source file and the lib to the entry
			// file and take the shorter of the two as the common module directory to remove
			// from the path to find the external module name
			var
				was = name,
				from = path.relative(entry.lib, path.dirname(entry.from)) || path.dirname(entry.from),
				to = path.relative(entry.lib, path.dirname(name)),
				// whichever is shorter or equal
				shorter = to.length > from.length ? from : to,
				base = path.join(entry.lib, shorter);
			name = path.join(entry.libName, path.relative(base, name));
		}
	}
	return name;
};