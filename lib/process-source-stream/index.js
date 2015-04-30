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
		resolver: null,
		// per-file preprocessors
		preprocessors: null
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
	this._packages = {};
	
	// map of path 
	
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
		Object.keys(stream._packages).forEach(function (entry) { stream.push(stream._packages[entry]); });
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
	
	resolver(entry, this.options, function (err, file) {
		
		if (err) {
			stream.emit('error', err);
			return done();
		}
		
		if (!file) {
			logger.log('debug', 'skipping, no resolver handled: %s', entry.path);
			return done();
		}
		
		if (entry.isFile) stream._modules[file] = entry;
		else if (entry.isDirectory) stream._packages[file] = entry;
		done();
	});
	
};