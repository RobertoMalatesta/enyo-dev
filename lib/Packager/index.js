'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	through = require('through2'),
	merge = require('merge'),
	defined = require('defined');

var
	EventEmitter = require('events').EventEmitter;

var
	defaults = require('./defaults'),
	log = require('../logger'),
	factor = require('./lib/factor-source-stream'),
	source = require('./lib/process-source-stream'),
	assets = require('./lib/process-assets-stream'),
	style = require('./lib/process-style-stream'),
	sort = require('./lib/sort-bundle-stream'),
	pack = require('./lib/pack-bundle-stream'),
	listDeps = require('./lib/list-dependency-stream'),
	bundle = require('./lib/bundle-output-stream'),
	output = require('./lib/write-files-stream');


module.exports = Packager;



function Packager (opts) {
	if (!this instanceof Packager) return new Packager(opts);
	
	EventEmitter.call(this);
	
	this._ready = false;
	
	var pack = this;
	process.nextTick(function () { pack.initialize(opts); });
}

util.inherits(Packager, EventEmitter);

/**
* Does the grunt work for initializing all of the packager options giving the correct priority to
* command-line overrides of any optionally provided package.json configuration.
*/
Packager.prototype.initialize = function (opts) {
	
	var
		pack = this,
		pkgPath;
	
	opts = (opts && merge(this.options, opts)) || merge(true, defaults);
	opts.package = path.resolve(opts.package);
	pkgPath = path.join(opts.package, 'package.json');
	fs.readFile(pkgPath, 'utf8', function (err, json) {
		if (err) throw new Error(
			'unable to resolve package.json file "' + pkgPath + '"'
		);
		
		try {
			json = JSON.parse(json);
		} catch (e) {
			throw new Error(
				'unable to parse package.json file "' + pkgPath + '": ' + e
			);
		}
		
		json.main = defined(json.main, 'index.js');
		// for these properties we need to ensure that, if specified in the json, are relative to
		// the json regardless of where we are executing the process from
		if (json.paths) json.paths = json.paths.map(function (libPath) {
			return path.relative(process.cwd(), path.join(opts.package, libPath)) || '.';
		});
		if (json.outdir) json.outdir = path.relative(process.cwd(), path.join(opts.package, json.outdir)) || '.';
		
		Object.keys(json).forEach(function (key) {
			if (opts[key] != null) {
				if (opts[key] === defaults[key]) opts[key] = json[key];
			} else opts[key] = json[key];
		});
		
		opts.cwd = process.cwd();
		if (opts.isLibrary) opts.externals = false;
		if (opts.production === true || opts.production === false) {
			opts.devMode = ! opts.production;
		} else if (!opts.devMode) opts.production = true;
		opts.title = defined(opts.title, path.basename(opts.cwd));
		log.setLogLevel(opts.logLevel);
		pack.options = opts;
		pack._ready = true;
		pack.emit('ready', pack);
	});
	
};

Packager.prototype.run = function () {
	if (!this._ready) return this.once('ready', this.run.bind(this));
	
	var
		opts = this.options,
		packager = this,
		stream = source(opts);
	
	if (opts.listOnly) {
		stream
			.pipe(factor(opts))
			.pipe(sort(opts))
			.pipe(listDeps(opts))
			.pipe(process.stdout);
	}

	else {
		
		log.info('beginning %s build for %s', opts.production ? 'production' : 'development', opts.package);
		
		stream
			.pipe(factor(opts))
			.pipe(sort(opts))
			.pipe(style(opts))
			.pipe(assets(opts))
			.pipe(pack(opts))
			.pipe(bundle(opts))
			.pipe(output(opts))
			.on('finish', function () {
				
				log.info('build complete');
				
				packager.emit('end');
			})
	}

	stream.end({path: opts.package, entry: true});
};