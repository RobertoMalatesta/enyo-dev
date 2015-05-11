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
	
	Transform.call(this, {objectMode: true});
}

util.inherits(PackBundleStream, Transform);

PackBundleStream.prototype._transform = function (bundle, nil, next) {
	
	log.debug('packaging the JavaScript for bundle %s', bundle.name);
	
	this.wrap(bundle);
	next(null, bundle);
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
		
		log.debug('attempting to uglify the JavaScript for bundle %s', bundle.name);
		
		try {
			bundleSrc = uglify.minify(bundleSrc, {
				fromString: true,
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