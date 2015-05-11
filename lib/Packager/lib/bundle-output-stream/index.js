'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs-extra');

var
	Transform = require('stream').Transform;

var
	nunjucks = require('nunjucks');

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
}

util.inherits(BundleOutputStream, Transform);

BundleOutputStream.prototype._transform = function (bundle, nil, next) {
	console.log('_transform', bundle.name);
	this._bundles[bundle.name] = bundle;
	this._order.push(bundle.name);
	next(null, bundle);
};

BundleOutputStream.prototype._flush = function (done) {
	
	var
		opts = this.options,
		stream = this;
	
	function finish () {
		console.log('finished');
		done();
	}
	console.log('_flush');
	if (!opts.isLibrary) {
		this.fetchTemplate(function (err, contents) {
			if (err) return stream.emit('error', new Error(
				'failed to find the template file\noriginal: ' + err
			));
			
			stream.bundle(finish, contents);
		});
	} else this.bundle(finish);
	
};

BundleOutputStream.prototype.bundle = function (done, contents) {

	var
		opts = this.options,
		stream = this;
	this.prepareStyles();
	this.prepareScripts();
	this.prepareAssets();
	if (!opts.isLibrary) stream.prepareIndex(contents);
	
	// @todo This is by no means a final form of this code...
	fs.ensureDir(opts.outdir, function (err) {
		if (err) return stream.emit('error', err);
		
		stream.writeStylesheets(function (err) {
			if (err) return stream.emit('error', err);
		
			stream.writeScripts(function (err) {
				if (err) return stream.emit('error', err);
			
				stream.writeAssets(function (err) {
					if (err) return stream.emit('error', err);
				
					if (!opts.isLibrary) {
						stream.writeIndex(function (err) {
							if (err) return stream.emit('error', err);
						
							done();
						});
					} else done();
				});
			});
		});
	});
};

BundleOutputStream.prototype.fetchTemplate = function (done) {
	
	var
		opts = this.options,
		file = opts.templateIndex ? opts.templateIndex : path.join(__dirname, 'index.tpl');
	console.log('fetching template "' + file + '"');
	fs.readFile(file, 'utf8', done);
	
};

BundleOutputStream.prototype.prepareStyles = function () {
	
	var
		opts = this.options,
		bundles = this._bundles,
		order = this._order,
		stylesheets = this.stylesheets = [],
		style = '';
	
	order.forEach(function (nom) {
		var bundle = bundles[nom];
		if (bundle.style) {
			if (opts.devMode || opts.isLibrary) {
				stylesheets.push({
					href: bundle.name + '.css',
					outfile: path.join(opts.outdir, bundle.name + '.css'),
					body: bundle.style
				});
			} else {
				style += (bundle.style + '\n');
			}
		}
	});
	
	if (style && !(opts.devMode || opts.isLibrary)) {
		if (opts.inlineCss) {
			stylesheets.push({body: style});
		} else {
			stylesheets.push({
				href: opts.outCssFile,
				outfile: path.join(opts.outdir, opts.outCssFile),
				body: style
			});
		}
	}
};

BundleOutputStream.prototype.prepareScripts = function () {
	
	var
		opts = this.options,
		bundles = this._bundles,
		order = this._order,
		scripts = this.scripts = [],
		source = '';
	
	order.forEach(function (nom) {
		var bundle = bundles[nom];
		if (bundle.contents) {
			if (opts.devMode || opts.isLibrary) {
				scripts.push({
					src: bundle.name + '.js',
					outfile: path.join(opts.outdir, bundle.name + '.js'),
					body: bundle.contents
				});
			} else {
				source += (bundle.contents + '\n');
			}
		}
	});
	
	if (source && !(opts.devMode || opts.isLibrary)) {
		if (opts.inlineJs) {
			scripts.push({body: source});
		} else {
			scripts.push({
				src: opts.outJsFile,
				outfile: path.join(opts.outdir, opts.outJsFile),
				body: source
			});
		}
	}
};

BundleOutputStream.prototype.prepareIndex = function (contents) {
	var
		opts = this.options,
		data = {title: opts.title, scripts: this.scripts, stylesheets: this.stylesheets};
	
	this.index = {
		outfile: path.join(opts.outdir, opts.outfile),
		contents: nunjucks.renderString(contents, data)
	};
};

BundleOutputStream.prototype.prepareAssets = function () {
	
	var
		bundles = this._bundles,
		assets = [],
		bundle;

	for (var nom in bundles) {
		bundle = bundles[nom];
		if (bundle.assets) {
			assets = assets.concat(bundle.assets);
		}
	}
	
	this.assets = assets;
};

BundleOutputStream.prototype.writeStylesheets = function (done) {
	
	if (this.stylesheets.length) {
		var
			sheets = this.stylesheets.slice();
		
		(function writeSheet () {
			var sheet = sheets.shift();
			
			if (!sheet) return done();
			if (sheet.outfile) {
				console.log('writing stylesheet "' + sheet.outfile + '"');
				fs.writeFile(sheet.outfile, sheet.body, function (err) {
					if (err) return done(err);
					writeSheet();
				});
			} else writeSheet();
		})();
		
	} else done();
	
};

BundleOutputStream.prototype.writeScripts = function (done) {
	
	if (this.scripts.length) {
	
		var
			scripts = this.scripts.slice();
		
			(function writeScript () {
				var script = scripts.shift();
				
				if (!script) return done();
				if (script.outfile) {
					console.log('writing script "' + script.outfile + '"');
					fs.writeFile(script.outfile, script.body, function (err) {
						if (err) return done(err);
						writeScript();
					});
				} else writeScript();
			})();
	
	} else done();
	
};

BundleOutputStream.prototype.writeAssets = function (done) {
	
	if (this.assets.length) {
		
		var
			assets = this.assets.slice();
		
		(function writeAsset () {
			var asset = assets.shift();
			
			if (!asset) return done();
			console.log('copying asset "' + asset.from + '" to "' + asset.to + '"');
			fs.copy(asset.from, assets.to, function (err) {
				if (err) return done(err);
				writeAsset();
			});
		})();
		
	} else done();
};

BundleOutputStream.prototype.writeIndex = function (done) {
	
	if (this.index) {
		console.log('writing "' + this.index.outfile + '"');
		fs.writeFile(this.index.outfile, this.index.contents, done);
	}
	
};