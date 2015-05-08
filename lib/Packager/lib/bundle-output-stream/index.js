'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	Transform = require('stream').Transform,
	Parser = require('parse5').Parser;

var
	merge = require('merge'),
	utils = require('../../utils');

var
	defaults = {templateIndex: path.join(__dirname, 'template-index.html')},
	parser = new Parser();

module.exports = BundleOutputStream;

function BundleOutputStream (opts) {
	if (!(this instanceof BundleOutputStream)) return new BundleOutputStream(opts);
	
	var
		stream = this;
	
	opts = opts ||  {};
	this.options = merge(true, defaults, opts);
	if (opts.templateIndex.charAt(0) != '/') opts.templateIndex = path.join(opts.cwd, opts.templateIndex);
	Transform.call(this, {objectMode: true});
	
	this._bundles = {};
	this._order = [];
	
	fs.readFile(opts.templateIndex, 'utf8', function (err, contents) {
		if (err) return stream.emit('error', new Error('could not read template index file "' + opts.templateIndex + '"'));
		stream.templateAST = parser.parse(contents);
		if (opts.title) utils.setDocumentTitle(stream.templateAST, opts.title);
		stream.emit('ast:ready');
	});
}

util.inherits(BundleOutputStream, Transform);

BundleOutputStream.prototype._transform = function (bundle, nil, next) {
	
	this._bundles[bundle.name] = bundle;
	this._order.push(bundle.name);
	next();
	
};

BundleOutputStream.prototype._flush = function (done) {
	if (this.templateAST) this.prepare(done);
	else this.once('ast:ready', this.prepare.bind(this, done));
};

BundleOutputStream.prototype.prepare = function (done) {
	
};