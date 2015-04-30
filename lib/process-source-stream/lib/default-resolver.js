'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	walk = require('walk');

var
	files;






module.exports = function resolve (entry, options, cb) {
	
	if (!files) return getTree(options, resolve.bind(null, entry, options, cb));
	
	var
		file = path.resolve(options.cwd, entry.path),
		ext = path.extname(entry.path);
	
	fs.lstat()
	
	
	
	var file;
	
	if (entry && entry.path) {
		// relative path handling
		if (entry.path.charAt(0) == '.') {
			file = path.join(options.cwd, entry.path);
			if (!path.extname(entry.path) == '.js') file += '.js';
		}
	}
	
};


function getTree (options, cb) {
	
}