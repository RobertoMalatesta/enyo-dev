'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	glob = require('glob'),
	slash = require('slash'),
	merge = require('merge'),
	less = require('less'),
	log = require('../../../logger');

var
	Transform = require('stream').Transform,
	CleanCss = require('clean-css');

module.exports = ProcessStyleStream;

function ProcessStyleStream (opts) {
	if (!(this instanceof ProcessStyleStream)) return new ProcessStyleStream(opts);
	
	Transform.call(this, {objectMode: true});
	
	opts = opts || {};
	this.options = opts;
	this._bundles = [];
	this._cached = true;
}

util.inherits(ProcessStyleStream, Transform);

ProcessStyleStream.prototype._transform = function (bundle, nil, next) {

	log.debug('processing styles for bundle %s', bundle.name);

	var
		entries = [],
		files = [],
		map = {},
		src = '',
		stream = this,
		opts = this.options,
		base;
	
	this._bundles.push(bundle);
	
	if (bundle.cached) {
		log.debug('skipping processing for styles of %s', bundle.name);
		return next();
	}
	// all it takes is one changed bundle for us to need to recompute all of it together
	this._cached = false;
	
	if (opts.outCssFile) {
		base = path.relative(
			path.join(opts.outdir, path.dirname(opts.outCssFile)),
			path.join(opts.outdir, opts.outAssetDir)
		);
	}
	
	if (!base) base = opts.outAssetDir;
	
	bundle.order.forEach(function (nom) {
		var entry = bundle.modules[nom];
		if (entry.isPackage) {
			if (entry.json.styles) {
				
				log.debug('found that package %s has style entries', entry.name);
				
				entry.json.styles.forEach(function (style) {
					map[style] = entry;
					entries.push(style);
				});
			}
		}
	});
	
	processEntries();
	
	function processEntries () {
		var
			entry = entries.shift(),
			pkg;

		if (!entry) {
			
			log.debug('done processing glob entries for bundle %s', bundle.name, files);
			
			bundle.styleSources = files.slice();
			return processFiles();
		}
		pkg = map[entry];

		glob(entry, {cwd: pkg.fullpath}, function (err, found) {
			if (err) return stream.emit('error', err);
			
			found.forEach(function (file) {
				file = path.join(pkg.fullpath, file);
				
				if (files.indexOf(file) === -1) {
					map[file] = pkg;
					files.push(file);
				}
			});
			
			processEntries();
		});
	}
	
	function processFiles () {
		var
			file = files.shift(),
			pkg;
		
		if (!file) {
			
			log.debug('done concatenating style sources for bundle %s', bundle.name);
			
			bundle.rawStyle = src;
			return next();
		}
		pkg = map[file];
		fs.readFile(file, 'utf8', function (err, contents) {
			if (err) return stream.emit('error', err);
			contents = translateImportPaths(contents, path.dirname(file), file);
			contents = translateUrlPaths(contents, base, path.dirname(file), pkg.lib || pkg.fullpath, file);
			src += contents + '\n';
			
			processFiles();
		});
	}

};

ProcessStyleStream.prototype._flush = function (done) {
	// ok, we have to collect all of the style together, compile it, then separate it
	// back out again to be processed according to each individual bundle's scope
	var
		stream = this,
		opts = this.options,
		bundles = this._bundles,
		minifier = opts.production && new CleanCss({
			processImport: false,
			rebase: false,
			roundingPrecision: -1,
			keepSpecialComments: 0
		}),
		src = '';
	
	if (this._cached) {
		
		log.debug('all styles were cached without a need to re-process');
		
		bundles.forEach(function (bundle) { stream.push(bundle); });
		stream.push(null);
		return done();
	}
	
	log.debug('attempting to process any collective style');
	
	bundles.forEach(function (bundle) {
		if (bundle.rawStyle) {
			
			log.debug('using style from bundle %s', bundle.name);
			
			var tok = bundle.token = '/*bundle=' + bundle.name + '*/';
			src += '\n' + tok;
			src += bundle.rawStyle;
			src += tok + '\n';
		}
	});

	less
		.render(src)
		.then(function (compiled) {
			var css = compiled.css;
			bundles.forEach(function (bundle) {
				
				if (bundle.rawStyle) {
					var
						start = css.indexOf(bundle.token) + bundle.token.length + 1,
						end = css.lastIndexOf(bundle.token);
					
					bundle.style = css.slice(start, end);
					if (opts.production) {
						bundle.style = minifier.minify(bundle.style).styles;
					}
				}
				
				log.debug('done separating out the style for bundle %s', bundle.name);
				
				stream.push(bundle);
			});
			
			log.debug('--- END PROCESS-STYLE-STREAM ---');
			
			stream.push(null);
			done();
			
		}, function (err) {
			// for some reason less is catching exceptions...
			process.nextTick(function () {
				stream.emit('error', new Error(
					'failed to compile less: ' + err
				));
			});
		});
};


function translateImportPaths (text, base, file) {
	text = text.replace(/(\@import\s+(['"])(?!https?)([a-zA-Z0-9\ \/\-\.\@\{\}]+)\2)/g,
		function (match, full, wrap, src) {
			var ret;
			if (src.charAt(0) != '/') {
				ret = '@import \'' + (
						// we simply convert the relative path to the actual path
						slash(path.join(base, src))
					) + '\'';
				return ret;
			} else return full;
		}
	);
	return text;
}

function translateUrlPaths (text, base, origin, pkg, file) {
	text = text.replace(/url\((?!http)(?:\'|\")?([a-zA-Z0-9\ \.\/\-]*)(?:\'|\")?\)/g,
		function (match, exact) {
			var ret, rel, uri;
			// this may be a faulty assumption but we should only be seeing this match if
			// it is a path that begins from the root (or assumed root with a /) or a relative
			// path since the regex shouldn't match remote requests
			if (exact.charAt(0) != '/') {
				rel = path.relative(pkg, path.resolve(origin, exact));
				ret = 'url(\'' + (
					(uri = slash(path.join(base, rel)))
					) + '\')';
				return ret;	
			} else return match;
		}
	);
	return text;
}