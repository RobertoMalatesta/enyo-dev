'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform;

var
	uglify = require('uglify-js'),
	log = require('../../../logger');


var MODULE_START = '[function (module,exports,global,require,request){\n';
var MODULE_METHOD_END = '\n},{';
var MODULE_END = '}]';
var BUNDLE_START = '!function(r){function require(e){var t,o,i,u,f,w="string"==typeof e?manifest[e]:e,d=n[w];if(null!=d)return d;if(t=manifest[w],!t){if(r)return r(e);throw"cannot find the requested module "+e}return o=t[0],i=t[1],u=function(r){var n=i[r];return require(null!=n?n:r)},f={exports:{}},o(f,f.exports,window,u),n[w]=f.exports}var manifest={';
var BUNDLE_ENTRIES = '},n={},e=[';
var BUNDLE_END = '];window.require=require;for(var t=0;t<e.length;++t)require(e[t])}(window.require);';



module.exports = PackBundleStream;

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
	
	var opts = this.options;
	
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
		entries = [];
	
	bundle.order.forEach(function (nom, i) {
		var
			entry = bundle.modules[nom],
			src = MODULE_START + entry.contents + MODULE_METHOD_END;

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
};