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
	defined = require('defined');

var
	logger = require('../logger'),
	defaultResolver = require('./lib/default-resolver');

var
	defaults = {
		// paths will be normalized from this root
		cwd: process.cwd(),
		// handle locating files
		resolver: undefined,
		// per-file preprocessors
		preprocessors: undefined,
		// paths to search for files
		paths: []
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
	
	this.options = opts = opts ? merge(true, opts, defaults) : merge(true, defaults);
	this.preprocessors = defined(opts.preprocessors, []);
	this.resolver = defined(opts.resolver, defaultResolver);

	this._resolving = 0;
	this._modules = {};
	
	if (opts.paths.length) {
		opts.paths = opts.paths.map(function (search) {
			return path.resolve(opts.cwd, search);
		});
	}
	
	// this.on('error', function (err) { logger.log('error', err); });
}

util.inherits(ProcessSourceStream, Transform);

ProcessSourceStream.prototype._transform = function (entry, nil, next) {
	console.log('_transform', entry);
	
	this.resolveEntry(entry);
	next();
};

ProcessSourceStream.prototype._flush = function (cb) {
	this._flushing = true;
	console.log('_flush');
	
	var
		stream = this;
	
	function flush () {
		console.log('flush');
		Object.keys(stream._modules).forEach(function (entry) { stream.push(stream._modules[entry]); });
		stream.push(null);
		cb();
	};
	
	if (this._resolving > 0) return this.once('resolve:drain', flush);
	else flush();
};






ProcessSourceStream.prototype.resolveEntry = function (entry) {
	console.log('_resolveEntry', entry);
	this._resolving++;
	
	var
		stream = this,
		resolver = this.resolver;
	
	function done () {
		stream._resolving--;
		if (stream._resolving === 0 && stream._flushing) stream.emit('resolve:drain');
	}
	
	entry.path = defined(entry.path, entry.name);
	entry.name = defined(entry.name, entry.path);
	
	if (!(entry.name && entry.path)) {
		this.emit('error', 'no path or name for entry');
		return done();
	}
	
	// if we've seen this entry before, no reason to resolve it again
	if (this._modules[entry.name]) return done();
	
	resolver(entry, this.options, function (err, entry) {
		
		if (err) {
			stream.emit('error', err);
			return done();
		}
		
		if (!entry.resolved) {
			if (!entry.external || (entry.external && stream.options.externals)) {
				stream.emit('error', 'could not resolve external module "' + entry.name + '" ' +
					'for path "' + entry.path + '"');
				return done();
			}
			
			logger.log('debug', 'entry "%s" (%s) was unresolved', entry.name, entry.path);
		}
		
		stream._modules[entry.name] = entry;
		done();
	});
	
};