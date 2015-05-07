'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform;

module.exports = FactorSourceStream;

function FactorSourceStream (opts) {
	if (!(this instanceof FactorSourceStream)) return new FactorSourceStream(opts);
	
	opts = opts || {};
	this.options = opts;
	this._bundles = {};
	
	Transform.call(this, {objectMode: true});
}

util.inherits(FactorSourceStream, Transform);

FactorSourceStream.prototype._transform = function (entry, nil, next) {
	var
		bundles = this._bundles,
		opts = this.options,
		bundle, nom;
	
	if (entry.external) {
		if (!entry.libName) this.emit('error', new Error(
			'module "' + entry.name + '" noted as external but no library resolved'
		));
		nom = entry.libName;
		bundle = bundles[nom] || (bundles[nom] = {name: nom, fullpath: entry.lib, modules: {}});
	} else {
		nom = opts.title || path.basename(opts.cwd || process.cwd());
		bundle = bundles[nom] || (bundles[nom] = {name: nom, fullpath: entry.fullpath, modules: {}});
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