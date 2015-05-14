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
		bundle, cache, mod, cpy,
		stream = this;
	
	if (!opts.cache) return done();
	
	log.debug('preparing cache data');
	
	cache = {__bundles__: {}};

	for (var i = 0; i < bundles.length; ++i) {
		bundle = bundles[i];
		cache.__bundles__[bundle.name] = cpy = clone(bundle);
		cpy.cached = true;
		if (bundle.modules) {
			for (var nom in bundle.modules) {
				cache[nom] = bundle.modules[nom];
			}
			
			// so we don't have duplicate entries in the cache, it will need to be pieced back
			// together, but this storage is for quicker use in other cases
			cpy.modules = {};
		}
	}
	
	log.info('writing cache file');
	
	fs.writeJson(opts.cacheFile, cache, function (err) {
		if (err) stream.emit('error', new Error(
			'could not write the cache file "' + opts.cacheFile + '": ' + e.toString()
		));
		log.debug('done writing cache file %s', opts.cacheFile);
		done();
	});
};