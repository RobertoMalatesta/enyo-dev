'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	Transform = require('stream').Transform;

var
	nunjucks = require('nunjucks');

nunjucks.configure({watch: false});

module.exports = BundleOutputStream;

function BundleOutputStream (opts) {
	if (!(this instanceof BundleOutputStream)) return new BundleOutputStream(opts);
	
	var
		stream = this;
	
	opts = opts ||  {};
	this.options = opts;
	Transform.call(this, {objectMode: true});
	
	this._bundles = {};
	this._order = [];
	this._outputFiles = [];
}

util.inherits(BundleOutputStream, Transform);

BundleOutputStream.prototype._transform = function (bundle, nil, next) {
	this._bundles[bundle.name] = bundle;
	this._order.push(bundle.name);
	next();
};

BundleOutputStream.prototype._flush = function (done) {

	var
		opts = this.options,
		stream = this,
		end = function () {
			stream._outputFiles.forEach(function (file) { stream.push(file); });
			stream.push(null);
			done();
		};

	if (!opts.isLIbrary) {
		this.fetchTemplate(function (err, contents) {
			if (err) return stream.emit('error', new Error(
				'failed to find the template file\noriginal: ' + err
			));
			stream.bundle();
			stream.prepareIndex(contents);
			end();
		});
	} else {
		this.bundle();
		end();
	}
};

BundleOutputStream.prototype.bundle = function () {
	this.prepareStyles();
	this.prepareScripts();
	this.prepareAssets();
};

BundleOutputStream.prototype.fetchTemplate = function (done) {
	
	var
		opts = this.options,
		file = opts.templateIndex ? opts.templateIndex : path.join(__dirname, 'index.tpl');
	fs.readFile(file, 'utf8', done);
};

BundleOutputStream.prototype.prepareStyles = function () {
	
	var
		opts = this.options,
		bundles = this._bundles,
		order = this._order,
		stylesheets = this.stylesheets = [],
		outputFiles = this._outputFiles,
		style = '', sheet;
	
	order.forEach(function (nom) {
		var
			bundle = bundles[nom],
			sheet;
		if (bundle.style) {
			if (opts.devMode || opts.isLibrary) {
				sheet = {
					href: bundle.name + '.css',
					outfile: path.join(opts.outdir, bundle.name + '.css'),
					contents: bundle.style
				};
				stylesheets.push(sheet);
				outputFiles.push(sheet);
			} else {
				style += (bundle.style + '\n');
			}
		}
	});
	
	if (style && !(opts.devMode || opts.isLibrary)) {
		if (opts.inlineCss) {
			stylesheets.push({contents: style});
		} else {
			sheet = {
				href: opts.outCssFile,
				outfile: path.join(opts.outdir, opts.outCssFile),
				contents: style
			};
			stylesheets.push(sheet);
			outputFiles.push(sheet);
		}
	}
};

BundleOutputStream.prototype.prepareScripts = function () {
	
	var
		opts = this.options,
		bundles = this._bundles,
		order = this._order,
		scripts = this.scripts = [],
		outputFiles = this._outputFiles,
		source = '', script;
	
	order.forEach(function (nom) {
		var
			bundle = bundles[nom],
			script;
		if (bundle.contents) {
			if (opts.devMode || opts.isLibrary) {
				script = {
					src: bundle.name + '.js',
					outfile: path.join(opts.outdir, bundle.name + '.js'),
					contents: bundle.contents
				};
				scripts.push(script);
				outputFiles.push(script);
			} else {
				source += (bundle.contents + '\n');
			}
		}
	});
	
	if (source && !(opts.devMode || opts.isLibrary)) {
		if (opts.inlineJs) {
			scripts.push({contents: source});
		} else {
			script = {
				src: opts.outJsFile,
				outfile: path.join(opts.outdir, opts.outJsFile),
				contents: source
			};
			scripts.push(script);
			outputFiles.push(script);
		}
	}
};

BundleOutputStream.prototype.prepareIndex = function (contents) {
	var
		opts = this.options,
		data = {title: opts.title, scripts: this.scripts, stylesheets: this.stylesheets};
	this._outputFiles.push({
		outfile: path.join(opts.outdir, opts.outfile),
		contents: nunjucks.renderString(contents, data)
	});
};

BundleOutputStream.prototype.prepareAssets = function () {
	
	var
		bundles = this._bundles,
		outputFiles = this._outputFiles,
		bundle;

	for (var nom in bundles) {
		bundle = bundles[nom];
		if (bundle.assets) {
			bundle.assets.forEach(function (asset) {
				outputFiles.push(asset);
			});
		}
	}
};