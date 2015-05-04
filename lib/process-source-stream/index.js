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
	this._resolvingNames = {};
	this._dependentQueue = {};
	
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

ProcessSourceStream.prototype._flush = function (cb) {
	this._flushing = true;
	
	var
		stream = this;
	
	function flush () {
		Object.keys(stream._modules).forEach(function (entry) { stream.push(stream._modules[entry]); });
		stream.push(null);
		cb();
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
	
	// LEFT OFF HERE NEED TO FIND A WAY TO CONVERT FROM KEY'ING OFF OF NAME AND USE MORE UNIQUE
	// METHOD TO KEEP FROM LOOKING UP MODULES RELATIVE TO AN EXTERNAL MODULE (SINCE THEIR NAME
	// WILL BE A PATH AND NOT OF THE NORMAL FORM)
	entry.name = defined(entry.name, nameResolver(entry, this.options));

	// if we've seen this entry before, no reason to resolve it again
	if (this._modules[entry.name] || this._resolvingNames[entry.name]) {
		console.log('found existing entry for ', entry.name);
		return done();
	}
	console.log('no entry found, resolving ', entry.name);
	
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
		
		stream._modules[entry.name] = entry;
		stream._resolvingNames[entry.name] = null;
		console.log('assigned ' + entry.name);
		if (stream._dependentQueue[entry.name]) {
			entry.dependents = stream._dependentQueue[entry.name];
			stream._dependentQueue[entry.name] = null;
			console.log('set dependents from queued list for ', entry.name);
		}
		
		// we need to parse the content now for the require statements
		entry.requires = detective(entry.contents);
		
		if (entry.requires.length) {
			var base = path.dirname(entry.isPackage ? entry.main : entry.fullpath);
			// map these to resolvable object/entries and issues their resolution
			entry.requires = entry.requires.map(function (dep) {
				var
					next = {path: dep, base: base},
					// if possible, we lookup any dep to see if it already has an entry
					name = nameResolver(next, stream.options),
					known, deps;
				
				// if the module is being resolved we can't add ourselves as a dependent yet so
				// we queue the entry and it will be added when it is resolved
				if (stream._resolvingNames[name]) {
					console.log('queuing dependent ', entry.name, ' for ', name);
					stream._dependentQueue[name] = stream._dependentQueue[name] || [];
					stream._dependentQueue[name].push(entry.name);
					return name;
				}
				
				// if we have already resolved this module simply update the modules that are
				// dependent on it with the current module and carry on
				if ((known = stream._modules[name])) {
					console.log('adding dependent ', entry.name, ' for ', name);
					deps = known.dependents || (known.dependents = []);
					deps.push(entry.name);
					return name;
				}
				
				next.name = name;
				next.dependents = [entry.name];
				stream.resolveEntry(next);
				return name;
			});
		}
		
		done();
	});
	
};