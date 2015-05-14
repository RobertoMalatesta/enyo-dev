'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform;

var
	uglify = require('uglify-js'),
	combine = require('combine-source-map'),
	convert = require('convert-source-map'),
	log = require('../../../logger');


var MODULE_START = '[function (module,exports,global,require,request){\n';
var MODULE_METHOD_END = '\n},{';
var MODULE_END = '}]';
var BUNDLE_START = '!function(r){function require(e){var t,o,i,u,f,w="string"==typeof e?manifest[e]:e,d=n[w];if(null!=d)return d;if(t=manifest[w],!t){if(r)return r(e);throw"cannot find the requested module "+e}return o=t[0],i=t[1],u=function(r){var n=i[r];return require(null!=n?n:r)},f={exports:{}},o(f,f.exports,window,u),n[w]=f.exports}var manifest={';
var BUNDLE_ENTRIES = '},n={},e=[';
var BUNDLE_END = '];window.require=require;for(var t=0;t<e.length;++t)require(e[t])}(window.require);';



module.exports = PackBundleStream;

function nCount (src) {
	if (!src) return 0;
	var n = src.match(/\n/g);
	return n ? n.length : 0;
}

function PackBundleStream (opts) {
	if (!(this instanceof PackBundleStream)) return new PackBundleStream(opts);
	
	opts = opts || {};
	this.options = opts;
	this._bundles = {};
	this._order = [];
	Transform.call(this, {objectMode: true});
}

util.inherits(PackBundleStream, Transform);

PackBundleStream.prototype._transform = function (bundle, nil, next) {
	
	var
		opts = this.options,
		skip = opts.skipExternals;
	
	if (bundle.cached) {
		log.debug('skipping packing cached bundle %s', bundle.name);
		return next(null, bundle);
	}
	
	if (skip && skip.indexOf(bundle.name) > -1) {
		log.debug('skipping packing bundle %s', bundle.name);
		return next(null, bundle);
	}
	
	if (opts.production) {
		// in this case we want to package everything together and not bother with separate
		// files or bundles
		this._bundles[bundle.name] = bundle;
		this._order.push(bundle.name);
		next();
	} else {
	
		log.debug('packaging the JavaScript for bundle %s', bundle.name);
	
		this.wrap(bundle);
		next(null, bundle);
	}
};

PackBundleStream.prototype._flush = function (done) {
	
	var
		opts = this.options,
		bundles = this._bundles,
		order = this._order,
		stream = this;
	
	if (opts.production) {
		
		log.debug('handling output JavaScript source in production mode by merging all modules ' +
			'into a single bundle for output');
		
		this.mergeBundles();
		order.forEach(function (nom) {
			stream.push(bundles[nom]);
		});
		stream.push(null);
	}
	
	done();
	
};

PackBundleStream.prototype.mergeBundles = function () {
	
	var
		opts = this.options,
		stream = this,
		bundles = this._bundles,
		order = this._order,
		modules = {},
		orderedModules = [],
		masterBundle = bundles[order[order.length - 1]];
	
	order.forEach(function (nom) {
		var bundle = bundles[nom];
		
		for (var mod in bundle.modules) {
			modules[mod] = bundle.modules[mod];
		}
		
		orderedModules = orderedModules.concat(bundle.order);
	});
	
	masterBundle.order = orderedModules;
	masterBundle.modules = modules;
	
	this.wrap(masterBundle);
};

PackBundleStream.prototype.wrap = function (bundle) {
	
	var
		opts = this.options,
		stream = this,
		bundleSrc = BUNDLE_START,
		entries = [],
		devMode = opts.devMode,
		sourceMap,
		ln = 0;
	
	log.debug('wrapping bundle %s', bundle.name);
	
	if (devMode && opts.sourceMaps) {
		sourceMap = combine.create();
		ln = nCount(BUNDLE_START) + 1;
	}
	
	bundle.order.forEach(function (nom, i) {
		var
			entry = bundle.modules[nom],
			src = MODULE_START + entry.contents + MODULE_METHOD_END;
		
		log.debug('wrapping module %s', nom);
		
		if (devMode && entry.contents && opts.sourceMaps) {
			var rel = path.relative(opts.cwd, entry.fullpath);
			sourceMap.addFile({
				sourceFile: path.relative(opts.cwd, entry.main || entry.fullpath),
				source: entry.contents
			}, {line: ln});
		}

		bundleSrc += (i + ':');
		if (entry.requires && entry.requires.length) {
			var hasMap = false;
			entry.requires.forEach(function (req, j) {
				var id = bundle.order.indexOf(req.name);
				if (id > -1) {
					// only hit if it is an internal request
					src += ('"' + req.alias + '":' + id + ',');
					hasMap = true;
				} 
			});
			// remove the trailing comma if necessary
			if (hasMap) src = src.substring(0, src.length - 1);
		}
		src += MODULE_END;
		if (devMode && opts.sourceMaps) {
			ln += nCount(src);
		}
		bundleSrc += src;
		bundleSrc += (',' + '"' + (entry.external ? entry.name : (path.relative(opts.cwd, entry.name) || opts.title)) + '":' + i)
		if (entry.entry) entries.push(i);
		if (++i < bundle.order.length) bundleSrc += ',';
	});
	
	bundleSrc += BUNDLE_ENTRIES;
	
	if (entries.length) {
		bundleSrc += entries.join(',');
	}
	
	bundleSrc += BUNDLE_END;
	
	log.debug('bundle %s source has been built', bundle.name);
	
	if (opts.production) {
		
		log.info('attempting to uglify the JavaScript for bundle %s, this may take a while', bundle.name);
		
		try {
			bundleSrc = uglify.minify(bundleSrc, {
				fromString: true,
				mangle: {
					except: ['require', 'request']
				},
				output: {
					space_colon: false,
					beautify: false,
					semicolons: false
				}
			}).code;
			
			log.debug('done uglifying bundle %s', bundle.name);
			
		} catch (e) {
			stream.emit('error', new Error(
				'UglifyJS error while parsing "' + bundle.name + '"\noriginal: ' + e.toString()
			));
			console.log(e);
		}
	}
	bundle.contents = bundleSrc;
	if (devMode && opts.sourceMaps) {
		bundle.sourceMap = convert.fromBase64(sourceMap.base64()).toJSON();
		bundle.sourceMapFile = bundle.name + '.js.map';
		bundle.contents += ('\n//# sourceMappingURL=' + bundle.sourceMapFile);
	}
};