'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	PATHS = {};

module.exports = function resolve (x, y, paths, done) {
	
	var
		base = path.join(y, x);

	if (x.charAt(0) == '.' || x.charAt(0) == '/') {
		LOAD_FILE(base, function (err, result) {
			if (err) return done(err);
			if (!result) {
				LOAD_DIRECTORY(base, function (err, result) {
					if (err) return done(err);
					if (!result) {
						return done(new Error('module not found "' + x + '" from "' + y '"'));
					} else {
						return done(null, result);
					}
				});
			} else {
				return done(null, result);
			}
		});
	}


};



function LOAD_FILE (x, done) {
	fs.stat(x, function (err, stat) {
		if (err || !stat) {
			if (path.extname(x) != '.js') return LOAD_FILE(x + '.js', done);
			else done();
		} else {
			if (stat.isFile()) {
				fs.readFile(x, 'utf8', function (err, contents) {
					if (err) return done(err);
					done(null, {path: x, contents: contents});
				});
			} else if (stat.isDirectory()) {
				done();
			} else done(new Error('unable to handle response for path "' + x + '"'));
		}
	});
}


function LOAD_DIRECTORY (x, done) {
	var
		package = path.join(x, 'package.json');
	
	fs.readFile(package, 'utf8', function (err, json) {
		var result, main;
		
		if (err) return done();
		
		try {
			json = JSON.parse(json);
		} catch (e) { return done(e); }
		
		result = {
			isPackage: true,
			path: x,
			packageFile: package,
			json: json
		};
		
		main = path.join(x, json.main || 'index.js');
		
		LOAD_FILE(main, function (err, fileResult) {
			if (err) done(err);
			else if (!fileResult) done(new Error('unable to find "' + main + '" from "' + x + '"'));
			else {
				result.main = fileResult.path;
				result.contents = fileResult.contents;
				done(null, result);
			}
		});
	});
}


function LOAD_EXTERNAL (x, paths, done) {
	
}












