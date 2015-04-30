'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	defined = require('defined');

var
	logger = require('../../logger');






module.exports = function (entry, options, done) {
	
	var
		ext = path.extname(entry.path),
		files = [],
		base = path.join(defined(entry.base, options.cwd), entry.path);
	
	// relative path to file
	if (entry.path.charAt(0) == '.') {
		if (ext) files.push(base);
		else {
			files.push(base + '.js');
			files.push(base);
		}
	}
	// where we are actually resolving an external
	else if (options.externals) {
		if (options.paths.length === 0) {
			return done(new Error(
				'cannot resolve external dependency "' + entry.name + '" from "' + entry.path + '" ' +
				'without additional paths being supplied'
			));
		}
		
		else {
			options.paths.forEach(function (search) {
				var base = path.join(search, entry.path);
				
				if (ext) files.push(base);
				else {
					files.push(base + '.js');
					files.push(base);
				}
			});
		}
	}
	// this is the case where it is an external entry and we are not trying to resolve it
	else {
		entry.external = true;
		entry.resolved = false;
		return done(null, entry);
	}
	
	logger.log('debug', 'attempting to resolve %s from ', entry.name, files);
	
	resolve(files, function (contents, fullpath) {
	
		if (contents != null) {
			entry.contents = contents;
			entry.resolved = true;
			entry.fullpath = fullpath;
			
			logger.log('debug', 'resolved %s from %s', entry.name, fullpath);
		} else enry.resolved = false;
	
		done(null, entry);
	});

	
};


function resolve (files, done) {

	if (files.length) {
		var search = files.shift();
		fs.readFile(search, function (err, contents) {
			if (err) {
				// we swallow the error because the fact it wasn't found isn't a problem we report
				// from here, at least for now
				if (files.length) resolve(files, done);
				else done();
			}
			
			done(contents || '', search);
		});
	}

}