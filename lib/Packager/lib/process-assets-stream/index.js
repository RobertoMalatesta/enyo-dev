'use strict';

var
	util = require('util'),
	path = require('path');

var
	glob = require('glob'),
	log = require('../../../logger');

var
	Transform = require('stream').Transform;

module.exports = ProcessAssetsStream;

function ProcessAssetsStream (opts) {
	if (!(this instanceof ProcessAssetsStream)) return new ProcessAssetsStream(opts);
	
	Transform.call(this, {objectMode: true});
	
	opts = opts || {};
	this.options = opts;
}

util.inherits(ProcessAssetsStream, Transform);

ProcessAssetsStream.prototype._transform = function (bundle, nil, next) {
	
	log.debug('processing assets for bundle %s', bundle.name);
	
	var
		modules = bundle.modules,
		opts = this.options,
		map = {},
		assets = bundle.assets = [],
		files = [],
		entries = [],
		nom, mod;
	
	for (nom in modules) {
		mod = modules[nom];
		if (mod.isPackage) {
			if (opts.devMode && mod.json.devAssets) {
				mod.json.devAssets.forEach(function (asset) {
					map[asset] = mod;
					entries.push(asset);
				});
			}
			if (mod.json.assets) {
				mod.json.assets.forEach(function (asset) {
					map[asset] = mod;
					entries.push(asset);
				});
			}
		}
	}
	
	processEntries();
	
	function processEntries () {
		
		var
			entry = entries.shift(),
			pkg = entry && map[entry];
		
		if (!entry) {
			return next(null, bundle);
		}
		
		glob(entry, {cwd: pkg.fullpath}, function (err, found) {
			if (err) return stream.emit('error', err);
			
			found.forEach(function (file) {
				file = path.join(pkg.fullpath, file);
				var relOut = path.join(opts.outAssetDir, path.relative(pkg.fullpath, file));
				
				if (files.indexOf(file) === -1) {
					
					log.debug('adding asset %s to bundle %s', relOut, bundle.name);
					
					files.push(file);
					assets.push({source: file, outfile: path.join(opts.outdir, relOut), copy: true});
				}
			});
			
			processEntries();
		});
	}
	
};