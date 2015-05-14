'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	Transform = require('stream').Transform;

var
	nunjucks = require('nunjucks'),
	log = require('../../../logger');

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
		
	log.debug('fetching template index file %s', file);
		
	fs.readFile(file, 'utf8', done);
};

BundleOutputStream.prototype.prepareStyles = function () {
	
	var
		opts = this.options,
		bundles = this._bundles,
		order = this._order,
		stylesheets = this.stylesheets = [],
		outputFiles = this._outputFiles,
		skip = opts.skipExternals,
		style = '', sheet;
	
	log.info('preparing final style output');
	
	order.forEach(function (nom) {
		var
			bundle = bundles[nom],
			sheet;
		
		if (skip && skip.indexOf(nom) > -1) {
			log.debug('skipping output style preparation for bundle %s', nom);
			return;
		}
		
		if (bundle.style) {
			if (opts.devMode || opts.isLibrary) {
				sheet = {
					href: bundle.name + '.css',
					outfile: path.join(opts.outdir, bundle.name + '.css'),
					contents: bundle.style,
					cached: bundle.cached
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
	
	log.debug('stylesheets', stylesheets.map(function (entry) { return entry.outfile || 'inline'; }));
};

BundleOutputStream.prototype.prepareScripts = function () {
	
	var
		opts = this.options,
		bundles = this._bundles,
		order = this._order,
		scripts = this.scripts = [],
		outputFiles = this._outputFiles,
		skip = opts.skipExternals,
		source = '', script;
	
	log.info('preparing final output JavaScript source');
	
	order.forEach(function (nom) {
		var
			bundle = bundles[nom],
			script;
		
		if (skip && skip.indexOf(nom) > -1) {
			log.debug('skipping output script preparation for bundle %s', nom);
			return;
		}
		
		if (bundle.contents) {
			if (opts.devMode || opts.isLibrary) {
				script = {
					src: bundle.name + '.js',
					outfile: path.join(opts.outdir, bundle.name + '.js'),
					contents: bundle.contents,
					cached: bundle.cached
				};
				scripts.push(script);
				outputFiles.push(script);
				
				if (bundle.sourceMap) {
					outputFiles.push({
						contents: bundle.sourceMap,
						outfile: path.join(opts.outdir, bundle.sourceMapFile),
						cached: bundle.cached
					});
				}
				
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
	
	log.debug('scripts', scripts.map(function (entry) { return entry.outfile || 'inline'; }));
};

BundleOutputStream.prototype.prepareIndex = function (contents) {
	var
		opts = this.options,
		data = {
			title: opts.title,
			scripts: this.scripts,
			stylesheets: this.stylesheets,
			devMode: opts.devMode
		};
		
	log.info('rendering HTML content');
	
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

	log.info('preparing final assets to be copied to the destination package');

	for (var nom in bundles) {
		bundle = bundles[nom];
		// by default we don't re-copy files for cached bundles, if they are to be copied, start
		// with --clean
		if (bundle.assets) {
			bundle.assets.forEach(function (asset) {
				asset.cached = bundle.cached;
				outputFiles.push(asset);
			});
		}
	}
};