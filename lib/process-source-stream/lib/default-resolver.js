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
				entry.path = path.relative(options.cwd, entry.fullpath);
				entry.base = options.cwd;
			}
			done(null, entry);
		}
	});
};