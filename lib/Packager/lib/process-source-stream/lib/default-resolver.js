'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	defined = require('defined'),
	through = require('through2'),
	merge = require('merge');

var
	resolver = require('./external-resolver');

module.exports = function (entry, options, done) {
	resolver(entry.path, entry.base || options.cwd, options.externals ? options.paths : null, function (err, result) {
		if (err) done(err, entry);
		else if (!result) {
			entry.external = true;
			done(null, entry);
		} else {
			entry = merge(entry, result);
			entry.resolved = true;
			if (entry.external) {
				var ext;
				entry.path = path.relative(options.cwd, entry.fullpath);
				ext = path.extname(entry.path);
				if (ext) entry.path = entry.path.slice(0, -(ext.length));
				entry.base = options.cwd;
				// normalize the lib name here as this is the only gate that will always be hit
				// for lib entries
				entry.libName = entry.lib.split('/').pop();
			}
			done(null, entry);
		}
	});
};