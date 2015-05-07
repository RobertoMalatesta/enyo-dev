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
		if (!entry.libName) this.emit('error', new Error(
			'module "' + entry.name + '" noted as external but no library resolved'
		));
		bundle = bundles[entry.libName] || (bundles[entry.libName] = {name: entry.libName, fullpath: entry.lib, modules: {}});
	} else {
		bundle = bundles['app'] || (bundles['app'] = {name: 'app', fullpath: entry.fullpath, modules: {}});
	}
	
	bundle.modules[entry.name] = entry;
	next();
}

FactorSourceStream.prototype._flush = function (done) {
	for (var bundle in this._bundles) {
		this.push(this._bundles[bundle]);
	}
	this.push(null);
	done();
}