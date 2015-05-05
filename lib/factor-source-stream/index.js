'use strict';

var
	util = require('util');

var
	Transform = require('stream').Transform;

module.exports = FactorSourceStream;

function FactorSourceStream (opts) {
	if (!(this instanceof FactorSourceStream)) return new FactorSourceStream(opts);
	
	this._bundles = {};
	
	Transform.call(this, {objectMode: true});
}

util.inherits(FactorSourceStream, Transform);

FactorSourceStream.prototype._transform = function (entry, nil, next) {
	var
		bundles = this._bundles,
		bundle;
	
	if (entry.external) {
		bundle = bundles[entry.lib] || (bundles[entry.lib] = {});
	} else {
		bundle = bundles['app'] || (bundles['app'] = {});
	}
	
	bundle[entry.name] = entry;
	next();
}

FactorSourceStream.prototype._flush = function (done) {
	for (var bundle in this._bundles) {
		this.push({name: bundle, modules: this._bundles[bundle]});
	}
	this.push(null);
	done();
}