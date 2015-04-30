'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	defined = require('defined'),
	through = require('through2');

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
			files.push(path.join(base, 'package.json'));
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
					files.push(path.join(base, 'package.json'));
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
	
	resolve(files, options.preprocessors, function (contents, fullpath) {
	
		if (contents != null) {
			var basename = path.basename(fullpath);
			
			entry.resolved = true;
			
			// handle the case for the package.json of a module because we have more work to do
			if (basename == 'package.json') {
				entry.isPackage = true;
				
				logger.log('debug', 'found package for %s', entry.name);
				
				entry.packageFile = fullpath;
				entry.fullpath = path.dirname(fullpath);
				
				try {
					entry.json = JSON.parse(contents);
				} catch (e) {
					entry.resolved = false;
					return done(new Error('could not parse package.json file for module "' + fullpath + '"'), entry);
				}
				
				if (entry.json.main) {
					logger.log('debug', 'attempting to resolve main for %s', entry.name);
					
					fullpath = path.join(path.dirname(fullpath), entry.json.main);
					
					return fs.readFile(fullpath, 'utf8', function (err, contents) {
						if (err) {
							entry.resolved = false;
							return done(err, entry);
						}
						entry.contents = contents;
						entry.main = fullpath;
						
						done(null, entry);
					});
				} else {
					entry.resolved = false;
					return done(new Error('no "main" entry in package.json for module "' + fullpath + '"'), entry);
				}
			}
			
			entry.contents = contents;
			entry.fullpath = fullpath;
			
			logger.log('debug', 'resolved %s from %s', entry.name, fullpath);
		} else entry.resolved = false;
	
		done(null, entry);
	});

	
};


function resolve (files, processors, done) {
	
	console.log('RESOLVE', files, processors);
	
	function onerror (err) {
		// we swallow the error because the fact it wasn't found isn't a problem we report
		// from here, at least for now
		if (!err && files.length) resolve(files, processors, done);
		else done();
	}
	
	var
		search = files.shift(),
		buf = '',
		success;
	
	if (!search) return onerror();
	
	// we take the hit for stat'ing the file before creating the read stream so that we don't
	// uselessly cause the overhead of setting it up
	fs.lstat(search, function (err, stat) {
		if (err || stat.isDirectory()) return onerror();
		if (stat.isFile()) {
			var rs = fs.createReadStream(search, {encoding: 'utf8'});
			// will cause it to end, but the real error won't be reported...
			rs.on('error', onerror);
			if (processors.length) {
				for (var i = 0; i < processors.length; ++i) {
					rs.pipe(processors[i]);
				}
			}
			
			// only create this stream if we need to...
			success = through.obj(
				function (content, nil, next) {
					console.log('SUCCESS', content);
					buf += content;
					next();
				},
				function (end) {
					// we do this to let the read stream close before moving on and potentially
					// opening more fd's
					process.nextTick(function () { done(buf, search); });
					end();
				}
			);
			
			rs.pipe(success);
		}
	});

}