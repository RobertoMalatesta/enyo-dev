'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	Transform = require('stream').Transform,
	Promise = require('promise');

var
	merge = require('merge'),
	defined = require('defined'),
	detective = require('detective');
	

var
	defaultResolver = require('./lib/default-resolver'),
	nameResolver = require('./lib/name-resolver');

var
	defaults = {
		// paths will be normalized from this root
		cwd: process.cwd()
	};

module.exports = ProcessSourceStream;

/**
*
* Options
*
*
*/
function ProcessSourceStream (opts) {
	if (!(this instanceof ProcessSourceStream)) return new ProcessSourceStream(opts);
	
	Transform.call(this, {objectMode: true});
	this.options = opts = opts ? merge(true, defaults, opts) : merge(true, defaults);
	this.preprocessors = opts.preprocessors = defined(opts.preprocessors, []);
	this.resolver = defined(opts.resolver, defaultResolver);

	this._resolving = 0;
	this._modules = {};
	this._externals = {};
	this._resolvingNames = {};
	this._dependentQueue = {};
	this._fullpaths = {};
	
	opts.paths = defined(opts.paths, []);
	
	if (opts.paths.length) {
		opts.paths = opts.paths.map(function (search) {
			return path.resolve(opts.cwd, search);
		});
	}
	
}

util.inherits(ProcessSourceStream, Transform);

ProcessSourceStream.prototype._transform = function (entry, nil, next) {
	this.resolveEntry(entry);
	next();
};

ProcessSourceStream.prototype._flush = function (done) {
	this._flushing = true;
	
	var
		stream = this;
	
	function flush () {
		
		Object.keys(stream._fullpaths).forEach(function (fullpath) {
			stream.push(stream._fullpaths[fullpath]);
		});
		// notify stream end
		stream.push(null);
		done();
	};
	
	if (this._resolving > 0) return this.once('resolve:drain', flush);
	else flush();
};






ProcessSourceStream.prototype.resolveEntry = function (entry) {
	this._resolving++;
	
	var
		stream = this,
		resolver = this.resolver,
		ext;
	
	function done () {
		stream._resolving--;
		if (stream._resolving === 0 && stream._flushing) stream.emit('resolve:drain');
	}
	
	if (typeof entry.path != 'string') {
		this.emit('error', new Error('no path supplied for entry'));
		return done();
	}
	
	entry.name = defined(entry.name, nameResolver(entry, this.options));
	
	if (entry.external) {
		if (this._externals[entry.name]) {
			return done();
		}
	} else if (this._modules[entry.name] || this._resolvingNames[entry.name]) {
		// if we've seen this entry before, no reason to resolve it again
		return done();
	}
	
	this._resolvingNames[entry.name] = true;
	
	resolver(entry, this.options, function (err, entry) {
		
		if (err) {
			stream.emit('error', new Error(
				'could not resolve module "' + entry.name + '" from "' + (
				entry.dependents ? entry.dependents[entry.dependents.length - 1] : entry.fullpath) + '"' +
				'\noriginal error: ' + err.message
			));
			return done();
		}
		
		if (!entry.resolved) {
			if (!entry.external || (entry.external && stream.options.externals)) {
				stream.emit('error', new Error('could not resolve module "' + entry.name + '" ' +
					'from path "' + entry.fullpath + '"'));
				return done();
			}
		}
		
		stream._resolvingNames[entry.name] = null;
		
		if (entry.external) {
			if (stream.options.externals) {
				var existing;
				// check to see if, while we were resolving this entry, we completed resolving it by
				// a different path/name noting that the current entry.path was normalized - most 
				// likely it was matched by fullpath or name depending on how it was requested
				if ((existing = stream._externals[entry.name] || stream._externals[entry.fullpath] || stream._externals[entry.path])) {
					// console.log('entry existing for external ', entry.name, existing.name);
					// we check to see if the names match because, if the request was made from app
					// source via external reference format, but it was already included relative to
					// its library it wouldn't know this form so we update it to be complete
					if (existing.name != entry.name) {
						var exchar = existing.name.charAt(0), enchar = entry.name.charAt(0);
						if ((exchar == '.' || exchar == '/') && (enchar != '.' && enchar != '/')) {
							// this is really the case we're looking for to ensure that future 
							// external requests will correctly map back to this entry as well as 
							// relative paths
							existing.name = entry.name;
							// now there is another entry
							stream._externals[entry.name] = existing;
						
							// see if any other entries were waiting on this name instead of the 
							// other one and fix that relationship now
							if (stream._dependentQueue[entry.name]) {
								existing.dependents = existing.dependents
									? existing.dependents.concat(stream._dependentQueue[entry.name])
									: stream._dependentQueue[entry.name];
								stream._dependentQueue[entry.name] = null;
							}
						
							return done();
						} else if ((exchar != '.' && exchar != '/') && (enchar != '.' && enchar != '/')) {
							stream.emit('error', new Error(
								'invalid mismatch in external module naming: ' + existing.name + ' and ' + entry.name +
								'\n ' + existing.fullpath + ' and ' + entry.fullpath + '\n ' +
								existing.path + ' and ' + entry.path
							));
						}
					}
				} else {
					// we need to associate this external with as many ways as possible to it can be
					// found later and subsequnetly not reprocessed
					// console.log('assigning external ', entry.name, entry.path, entry.fullpath);
					stream._externals[entry.name] = entry;
					stream._externals[entry.fullpath] = entry;
					stream._externals[entry.path] = entry;
				}
			} else {
				// if we aren't resolving them doesn't mean we don't want them entered here
				stream._externals[entry.name] = entry;
			}
		}
		
		if (entry.fullpath) {
			if (stream._fullpaths[entry.fullpath]) {
				return done();
			} else stream._fullpaths[entry.fullpath] = entry;
		}
		
		if (!entry.external) {
			stream._modules[entry.name] = entry;
		}
		
		if (stream._dependentQueue[entry.name]) {
			entry.dependents = stream._dependentQueue[entry.name];
			stream._dependentQueue[entry.name] = null;
		}
		
		if (entry.contents) {
			// we need to parse the content now for the require statements
			entry.requires = detective(entry.contents);
		
			if (entry.requires.length) {
				var base = path.dirname(entry.isPackage ? entry.main : entry.fullpath);
				// map these to resolvable object/entries and issues their resolution
				entry.requires = entry.requires.map(function (dep) {
					var
						// note that everything included from an external entry is also external 
						//even if its not from the same library
						next = {path: dep, base: base, external: !! entry.external},
						// if possible, we lookup any dep to see if it already has an entry
						name = nameResolver(next, stream.options),
						known, deps;
				
					// if the module is being resolved we can't add ourselves as a dependent yet so
					// we queue the entry and it will be added when it is resolved
					if (stream._resolvingNames[name]) {
						stream._dependentQueue[name] = stream._dependentQueue[name] || [];
						stream._dependentQueue[name].push(entry.name);
						return name;
					}
				
					// if we have already resolved this module simply update the modules that are
					// dependent on it with the current module and carry on
					if ((known = stream._modules[name])) {
						deps = known.dependents || (known.dependents = []);
						deps.push(entry.fullpath);
						return name;
					}
				
					// if we've already resolved this as an external module, even by another name
					// then we need to skip resolving it again
					if ((known = stream._externals[name])) {
						// regardless of what it matched we ensure we return the external include 
						// name and not the
						return name;
					}
				
					next.name = name;
					next.dependents = [entry.name];
					stream.resolveEntry(next);
					return name;
				});
			}
		}
		
		done();
	});
	
};