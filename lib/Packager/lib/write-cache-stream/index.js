'use strict';

var
	fs = require('fs-extra'),
	util = require('util');

var
	clone = require('clone'),
	log = require('../../../logger');

var
	Transform = require('stream').Transform;

module.exports = WriteCacheStream;

function WriteCacheStream (opts) {
	if (!(this instanceof WriteCacheStream)) return new WriteCacheStream(opts);
	
	opts = opts || {};
	this.options = opts;
	this._bundles = [];
	
	Transform.call(this, {objectMode: true});
}

util.inherits(WriteCacheStream, Transform);

WriteCacheStream.prototype._transform = function (bundle, nil, next) {
	var
		opts = this.options;
	
	if (opts.cache) this._bundles.push(bundle);
	next(null, bundle);
};

WriteCacheStream.prototype._flush = function (done) {
	var
		opts = this.options,
		bundles = this._bundles,
		bundle, cache, mod,
		stream = this;
	
	if (!opts.cache) return done();
	
	log.debug('preparing cache data');
	
	cache = {_bundles: {}};
	
	for (var i = 0; i < bundles.length; ++i) {
		bundle = bundles[i];
		cache._bundles[bundle.name] = clone(bundle);
		
		if (bundle.modules) {
			for (var nom in bundle.modules) {
				cache[nom] = bundle.modules[nom];
			}
			
			// so we don't have duplicate entries in the cache, it will need to be pieced back
			// together, but this storage is for quicker use in other cases
			delete cache._bundles[bundle.name].modules;
		}
	}
	
	log.info('writing cache file');
	
	fs.writeJson('.e_cache', cache, function (err) {
		if (err) stream.emit('error', new Error(
			'could not write the cache file: ' + e.toString()
		));
		log.debug('done writing cache file .e_cache');
		done();
	});
};