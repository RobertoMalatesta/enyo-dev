'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	defined = require('defined'),
	through = require('through2');

var
	paths = {};

// module.exports = function (entry, options, done) {
//
// 	var
// 		ext = path.extname(entry.path),
// 		files = [],
// 		base = path.join(defined(entry.base, options.cwd), entry.path);
//
// 	// relative path to file
// 	if (entry.path.charAt(0) == '.') {
// 		if (ext) files.push(base);
// 		else {
// 			files.push(base + '.js');
// 			files.push(path.join(base, 'package.json'));
// 		}
// 	}
// 	// where we are actually resolving an external
// 	else if (options.externals) {
// 		if (options.paths.length === 0) {
// 			return done(new Error(
// 				'cannot resolve external dependency "' + entry.name + '" from "' +
// 				(entry.dependents ? entry.dependents[entry.dependents.length - 1] : options.cwd) + '" ' +
// 				'without additional paths being supplied'
// 			));
// 		}
//
// 		else {
// 			entry.external = true;
// 			// @todo Correct separator will be difficult to figure out without needing to test twice
// 			// since a mixture of code from multiple sources could use either...
// 			if (entry.path.indexOf('/') > -1) {
// 				// well this gets tricky because we're now going to explore to try and
// 				// find what we can, good thing is we can cache what we find to speed up
// 				// resolving packages for subsequent requests to the same library
// 				return resolveExternal(entry, options, finalize);
// 			}
//
// 			options.paths.forEach(function (search) {
// 				var base = path.join(search, entry.path);
//
// 				// the easiest case would be if for some reason a file extension was present
// 				// and we now know exactly what to look for
// 				if (ext) files.push(base);
// 				else {
// 					// the harder cases are because we need to determine if there is/are a/some
// 					// package(s) between here and the module that may mean we look it up a
// 					// different way
//
// 					// if it doesn't have any slashes its a huge relief
// 					files.push(base + '.js');
// 					files.push(path.join(base, 'package.json'));
// 				}
// 			});
// 		}
// 	}
// 	// this is the case where it is an external entry and we are not trying to resolve it
// 	else {
// 		entry.external = true;
// 		entry.resolved = false;
// 		// will override any assigned by the module that requested it originally
// 		entry.base = options.cwd;
// 		return done(null, entry);
// 	}
//
// 	function finalize (contents, fullpath) {
//
// 		if (contents != null) {
// 			var basename = path.basename(fullpath);
//
// 			entry.resolved = true;
//
// 			// handle the case for the package.json of a module because we have more work to do
// 			if (basename == 'package.json') {
// 				entry.isPackage = true;
//
// 				entry.packageFile = fullpath;
// 				entry.fullpath = path.dirname(fullpath);
//
// 				try {
// 					entry.json = JSON.parse(contents);
// 				} catch (e) {
// 					entry.resolved = false;
// 					return done(new Error('could not parse package.json file for module "' + fullpath + '"'), entry);
// 				}
//
// 				if (entry.json.main) {
// 					fullpath = path.join(path.dirname(fullpath), entry.json.main);
//
// 					return fs.readFile(fullpath, 'utf8', function (err, contents) {
// 						if (err) {
// 							entry.resolved = false;
// 							return done(err, entry);
// 						}
// 						entry.contents = contents;
// 						entry.main = fullpath;
//
// 						done(null, entry);
// 					});
// 				} else {
// 					entry.resolved = false;
// 					return done(new Error('no "main" entry in package.json for module "' + fullpath + '"'), entry);
// 				}
// 			}
//
// 			entry.contents = contents;
// 			entry.fullpath = fullpath;
//
// 		} else entry.resolved = false;
//
// 		done(null, entry);
// 	}
//
// 	resolve(files, options.preprocessors, finalize);
//
// };
//
//
// function resolve (files, processors, done) {
//
// 	function onerror (err) {
// 		// we swallow the error because the fact it wasn't found isn't a problem we report
// 		// from here, at least for now
// 		if (!err && files.length) resolve(files, processors, done);
// 		else done();
// 	}
//
// 	var
// 		search = files.shift(),
// 		buf = '',
// 		success;
//
// 	if (!search) return onerror();
//
// 	// we take the hit for stat'ing the file before creating the read stream so that we don't
// 	// uselessly cause the overhead of setting it up
// 	fs.lstat(search, function (err, stat) {
// 		if (err || stat.isDirectory()) return onerror();
// 		if (stat.isFile()) {
// 			var rs = fs.createReadStream(search, {encoding: 'utf8'});
// 			// will cause it to end, but the real error won't be reported...
// 			rs.on('error', onerror);
// 			if (processors.length) {
// 				for (var i = 0; i < processors.length; ++i) {
// 					rs.pipe(processors[i]);
// 				}
// 			}
//
// 			// only create this stream if we need to...
// 			success = through.obj(
// 				function (content, nil, next) {
// 					buf += content;
// 					next();
// 				},
// 				function (end) {
// 					end();
// 					// we do this to let the read stream close before moving on and potentially
// 					// opening more fd's
// 					done(buf, search)
// 				}
// 			);
//
// 			rs.pipe(success);
// 		}
// 	});
//
// }
//
//
// function walk (dir, done) {
// 	if (paths[dir]) done(null, paths[dir]);
//
// 	var
// 		ret = [];
// 	fs.readdir(dir, function (err, files) {
// 		var file, waiting = files.length;
// 		if (err) done(err);
// 		if (!waiting) return done(null, files);
// 		for (var i = 0; i < list.length; ++i) {
// 			file = path.join(dir, list[i]);
// 			fs.stat(file, function (err, stat) {
// 				if (stat) {
// 					ret.push(file);
// 					if (stat.isDirectory()) {
// 						walk(file, function (err, res) {
// 							ret = ret.concat(res);
// 							if (!--waiting) done(null, ret);
// 						});
// 					} else {
// 						if (!--waiting) done(null, ret);
// 					}
// 				}
// 			});
// 		}
// 	});
// }
//
//
// function resolveExternal (entry, options, done) {
//
// 	var
// 		dirs = options.paths.slice(),
// 		parts = entry.path.split('/'),
// 		dir, search, pkg;
//
// 	function locate () {
// 		dir = dirs.shift();
// 		if (dir) {
// 			walk(dir, function (err, files) {
// 				if (err) return done();
// 				paths[dir] = files;
// 				search = path.join(dir, parts[0]);
// 				// we have to check to see one piece at a time ensuring that we look for package
// 				// files along the way that might give us additional search paths
// 				if (files.indexOf(search) > -1) {
// 					// try and get lucky
// 					if (files.indexOf(entry.path)) {
// 						// apparently it was exactly right
// 						return fs.readFile(path.join(dir, entry.path))
// 					}
//
//
// 					// ok this is definitely the directory that has our file
// 					// now we check for a package file for any more information
// 					pkg = path.join(search, 'package.json');
// 					if (files.indexOf(pkg) > -1) {
// 						// ok there is a package file so we need to fetch it
// 						if (paths[pkg]) {
// 							// already had it
// 						} else {
// 							fs.readFile(pkg, function (err, json) {
// 								if (err) return done();
// 								paths[pkg] = JSON.parse(json);
// 							});
// 						}
// 					}
// 				} else locate();
// 			});
// 		} else done();
//
// 		function checkJson (pkg)
// 	}
//
//
//
//
// 	function locate (piece) {
// 		var
// 			pkgfile;
//
// 		dir = piece || dirs.shift();
// 		if (paths[dir]) {
// 			if (paths[dir].indexOf(parts[0]) > -1) {
// 				search = path.join(dir, parts.shift());
// 				return find();
// 			}
// 			locate();
// 		} else {
// 			fs.readdir(dir, function (err, files) {
// 				if (err) throw err;
// 				paths[dir] = files.map(function (file) { return path.join(dir, file); });
// 				locate(dir);
// 			});
// 		}
// 	}
//
// 	function find () {
//
// 	}
//
//
//
//
// 	var
// 		// @todo Same as above todo about using the correct separator, don't want to have to test
// 		// everything twice...
// 		ext = path.extname(entry.path),
// 		steps = entry.path.split('/'),
// 		roots = options.paths.slice(),
// 		// the root directory to start looking in, if we haven't found it then we need to keep
// 		// looking
// 		root = roots.length === 1 ? roots.pop() : null,
// 		step = steps.shift(),
// 		buf = '', next;
//
// 	if ((next = paths[root])) {
// 		buf = root;
// 		while ((next = next[step])) {
// 			buf = path.join(buf, step);
// 			if (!steps.length) {
// 				if (ext) buf = buf.splice(0, -buf.length);
//
// 			}
// 		}
//
//
// 		if (paths[root][step])
// 	}
//
//
// 	function findRoot () {
//
//
//
// 		if (root) {
//
// 		}
// 	}
//
// 	function
//
//
//
// 	(function next () {
// 		var
// 			step = steps.shift();
//
// 			if (!step) {
// 				// didn't find it apparently
// 				return done(new Error('could not resolve module "' + entry.path + '" from ' +
// 				(entry.dependents ? entry.dependents[entry.dependents.length - 1] : options.cwd)));
// 			}
// 	})();
//
// }