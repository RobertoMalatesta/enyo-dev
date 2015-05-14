'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform;

var
	merge = require('merge'),
	defined = require('defined'),
	detective = require('detective');
	

var
	defaultResolver = require('./lib/default-resolver'),
	nameResolver = require('./lib/name-resolver'),
	log = require('../../../logger');

var NODE_BUILTINS = [
	'fs','path','vm','zlib','util','url','udp4','tty','tls','string_decoder','stream','repl',
	'readline','punycode','os','net','http','https','events','crypto','cluster','child_process',
	'buffer','assert'
];

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

	// like with all of the other streams in packager the options need to be setup elsewhere
	// to reduce unnecessary overhead of resolving them per-stream (unless later we find that
	// necessary for some reason)
	opts = opts || {};
	this.options = opts;
	
	var cache = opts.cache && typeof opts.cache == 'object' ? opts.cache : null;

	this.preprocessors = opts.preprocessors = defined(opts.preprocessors, []);
	this.resolver = defined(opts.resolver, defaultResolver);

	this._resolving = 0;
	this._resolvingNames = {};
	
	var
		mods = this._modules = {},
		exts = this._externals = {},
		fpaths = this._fullpaths = {};
	
	opts.paths = defined(opts.paths, []);
	
	if (cache) {
		
		this._cacheChecked = [];
		
		log.debug('processing cached data before resolving dependencies');
		
		Object.keys(cache).forEach(function (nom) {
			
			if (nom == '__bundles__') return;
			
			var entry = cache[nom];
			if (entry) {
				mods[nom] = entry;
				fpaths[entry.fullpath] = entry;
				if (entry.external) exts[nom] = entry;
				entry.cached = true;
			}
		});
	}
	
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
		
		var
			externals = stream._externals,
			fullpaths = stream._fullpaths,
			modules = stream._modules;
		
		Object.keys(stream._fullpaths).forEach(function (fullpath) {
			var
				entry = stream._fullpaths[fullpath],
				i, req;
			stream.push(entry);
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
		opts = this.options,
		ext, exist;
	
	if (typeof entry == 'string') entry = {path: entry};
	
	function done () {
		stream._resolving--;
		if (stream._resolving === 0 && stream._flushing) stream.emit('resolve:drain');
	}
	
	if (typeof entry.path != 'string') {
		if (entry.name) entry.path = entry.name;
		else {
			this.emit('error', new Error('no path supplied for entry: ' + entry));
			return done();
		}
	}
	
	entry.name = defined(entry.name, nameResolver(entry, this.options));
	
	log.debug('resolving %s', entry.name);
	
	if (entry.external) {
		if ((exist = this._externals[entry.name])) {
			
			log.debug('%s is already resolved as an external entry', entry.name);
			
			if (exist.cached) entry = exist;
			else return done();
		}
	} else if ((exist = this._modules[entry.name] || this._resolvingNames[entry.name])) {
		
		log.debug('%s is %s', entry.name, this._modules[entry.name] ? 'resolved' : 'already being resolved');
		
		if (exist.cached) entry = exist;
		
		// if we've seen this entry before, no reason to resolve it again
		else return done();
	}
	
	this._resolvingNames[entry.name] = true;
	
	if (entry.cached) {
		if (this._cacheChecked.indexOf(entry.name) > -1) {
			log.debug('cached module %s has already had its dependencies resolved', entry.name);
			return done();
		}
		
		log.debug('ensuring dependencies of cached entry %s', entry.name);
		// we have to ensure that we evaluate all of its dependencies as well as they may not be
		// cached anymore
		return resolved(null, entry);
	}
	
	function resolved (err, entry) {
		
		if (err) {
		
			if (NODE_BUILTINS.indexOf(entry.name) > -1) {
				log.warn('skipping builtin module %s from %s', entry.name, path.relative(opts.cwd, entry.from));
				var prev = stream._fullpaths[entry.from];
				if (!prev) {
					stream.emit('error', new Error(
						'could not properly remove builtin module "' + entry.name + '" from its ' +
						'requestor "' + entry.from + '"'
					));
					return done();
				}
				var i = prev.requires.indexOf(entry.name);
				prev.requires.splice(i, 1);
				return done();
			}
		
			stream.emit('error', new Error(
				'could not resolve module "' + entry.name + '" from "' + (
				entry.from ? entry.from : entry.fullpath) + '"' +
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
		
			log.debug('module %s was not resolved, but apparently that is OK', entry.name);
		}
	
		stream._resolvingNames[entry.name] = null;
	
		if (!entry.cached) {
			if (entry.fullpath) {
				if (stream._fullpaths[entry.fullpath]) {
			
					log.debug('module %s was resolved, but apparently had already been resolved as %s',
					entry.name, stream._fullpaths[entry.fullpath].name);
			
					return done();
				} else stream._fullpaths[entry.fullpath] = entry;
			}
	
			if (entry.external) {
				var existing = stream._externals[entry.name];
				if (existing) {
			
					log.debug('external module %s was resolved, but had already been resolved', entry.name);
			
					return done();
				} else {
					stream._externals[entry.name] = entry;
				}
			} else {
				stream._modules[entry.name] = entry;
			}
	
			log.debug('resolved module %s', entry.name);
	
			if (entry.contents) {
		
				// @todo Need to add back in pre-processing support for plugin-like features
		
				// we need to parse the content now for the require statements
		
				try {
					entry.requires = detective(entry.contents);
				} catch (e) {
					stream.emit('error', new Error(
						'error parsing file "' + entry.fullpath + '" for requires: ' + e.toString()
					));
				}
			}
		}

		if (entry.requires && entry.requires.length) {
		
			log.debug('module %s requires these modules: ', entry.name, entry.requires);
			
			if (entry.cached) {
				
				log.debug('module %s was cached, adding to resolved cache', entry.name);
				
				stream._cacheChecked.push(entry.name);
				entry.requires.forEach(function (dep) { stream.resolveEntry(dep.name); });
				return done();
			}
		
			var base = path.dirname(entry.isPackage ? entry.main : entry.fullpath);
			// map these to resolvable object/entries and issues their resolution
			entry.requires = entry.requires.map(function (dep) {
				var
					// note that everything included from an external entry is also external 
					// even if its not from the same library, setting the lib here works as
					// even a library reaching into another library will not be relatively
					// pathed thus it will be resolved externally and this value will be
					// overwritten as expected, otherwise it is correct
					next = {
						path: dep,
						base: base,
						external: !! entry.external,
						lib: entry.lib,
						libName: entry.libName,
						from: entry.fullpath
					},
					// if possible, we lookup any dep to see if it already has an entry
					name = nameResolver(next, stream.options),
					ret = {name: name, alias: dep},
					known, deps;
			


		
				// if the module is being resolved we can't add ourselves as a dependent yet so
				// we queue the entry and it will be added when it is resolved
				if (stream._resolvingNames[name]) {
					log.debug('dependency %s is already being resolve', name);
					return ret;
				}
		
				// if we have already resolved this module simply update the modules that are
				// dependent on it with the current module and carry on
				if ((known = stream._modules[name])) {
					log.debug('dependency %s has already been resolved', name);
					
					return ret;
				}
		
				// if we've already resolved this as an external module, even by another name
				// then we need to skip resolving it again
				if ((known = stream._externals[name])) {
					log.debug('dependency %s has already been resolved as an external module', name);
					
					// regardless of what it matched we ensure we return the external include 
					// name and not the
					return ret;
				}
		
				next.name = name;
				stream.resolveEntry(next);
				return ret;
			});
		}
	
		done();
	}
	
	resolver(entry, this.options, resolved);
	
};