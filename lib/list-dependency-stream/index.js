'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform;

var
	archy = require('archy');


module.exports = ListDependencyStream;

function ListDependencyStream (opts) {
	if (!(this instanceof ListDependencyStream)) return new ListDependencyStream(opts);
	
	opts = opts || {};
	this.options = opts;
	
	Transform.call(this, {objectMode: true});
	
	this._bundles = {};
}

util.inherits(ListDependencyStream, Transform);

ListDependencyStream.prototype._transform = function (bundle, nil, next) {
	
	this._bundles[bundle.name] = bundle;
	next();
	
};

ListDependencyStream.prototype._flush = function (done) {
	
	var
		bundles = this._bundles,
		base = {label: 'bundles', nodes: []};
	
	for (var nom in bundles) {
		base.nodes.push(this.render(bundles[nom]));
	}
	
	this.push(archy(base));
	this.push(null);
	done();
};

ListDependencyStream.prototype.render = function (bundle, level) {
	
	var
		ret = {},
		opts = this.options;
	ret.label = bundle.name + '@' + (path.relative(opts.cwd, bundle.fullpath) || path.basename(bundle.fullpath));
	ret.nodes = bundle.order.map(function (nom) {
		return (nom.charAt(0) == '/' ? path.relative(opts.cwd, nom) : nom) || path.basename(nom);
	});
	return ret;
};