'use strict';

var
	util = require('util');

var
	findIndex = require('find-index'),
	log = require('../../../logger');

var
	Transform = require('stream').Transform;

module.exports = SortBundleStream;

function SortBundleStream (opts) {
	if (!(this instanceof SortBundleStream)) return new SortBundleStream(opts);
	
	Transform.call(this, {objectMode: true});
	
	opts = opts || {};
	this.options = opts;
	this._bundles = [];
}

util.inherits(SortBundleStream, Transform);

SortBundleStream.prototype._transform = function (bundle, nil, next) {
	this._bundles.push(bundle);
	
	next();
};

/**
* @todo Refactor to share same sorting method.
*/
SortBundleStream.prototype._flush = function (done) {

	var
		stream = this,
		opts = this.options,
		bundles = this._bundles,
		map = {},
		graph = {},
		ordered = [],
		nodes = [],
		cycles;
	
	bundles.forEach(function (bundle) {
		stream.sort(bundle);
		map[bundle.name] = bundle;
		if (bundle.externals.length) {
			var deps = {};
			bundle.externals.forEach(function (ext) {
				var lib, idx = findIndex(bundles, function (bundle) {
					return bundle.modules[ext];
				});
				
				if (idx === -1) {
					lib = ext.split('/').shift();
					
					if (opts.externals) {
						stream.emit('error', new Error(
							'cannot find which bundle the "' + ext + '" ' + 'module belongs to ' +
							'from the "' + bundle.name + '" bundle'
						));
					}
				} else {
					deps[bundles[idx].name] = null;
				}
			});
			bundle.requires = Object.keys(deps);
			if (!bundle.requires.length) {
				log.debug('bundle %s has no other bundle dependencies', bundle.name);
				nodes.push(bundle);
			}
			else {
				log.debug('bundle %s requires these bundles', bundle.name, bundle.requires);
				
				bundle.requires.forEach(function (dep) {
					var deps = graph[dep] || (graph[dep] = []);
					deps.push(bundle);
				});
			}
		} else nodes.push(bundle);
	});
	
	while (nodes.length) {
		var
			node = nodes.shift(),
			deps = graph[node.name];
		
		ordered.push(node);
		if (deps && deps.length) {
			deps.forEach(function (dep) {
				var idx = dep.requires.indexOf(node.name);
				if (idx === -1) {
					if (stream.options.externals) {
						stream.emit('error', new Error(
							'cannot find required bundle "' + node.name + '" ' + 'from "' + dep.name + '"'
						));
					}
				} else {
					dep.requires.splice(idx, 1);
				}
				if (!dep.requires.length) {
					nodes.push(dep);
					delete dep.requires;
				}
			});
		}
		delete graph[node.name];
	}
	
	if ((cycles = Object.keys(graph)).length) {
		this.emit('error', new Error('unmet or circular dependencies: ' + cycles.join(',')));
	}
	
	log.debug('final order of bundles', ordered.map(function (bundle) { return bundle.name; }));
	
	ordered.forEach(function (bundle) { stream.push(bundle); });
	
	log.debug('--- END SORT-BUNDLE-STREAM ---');
	
	stream.push(null);
	done();
};




SortBundleStream.prototype.sort = function (bundle) {
	var
		graph = {},
		map = bundle.modules,
		nodes = [],
		ordered = [],
		externals = {},
		cycles;
	
	log.debug('sorting bundle %s, %d entries', bundle.name, Object.keys(map).length);

	Object.keys(map).forEach(function (nom) {

		var
			entry = map[nom],
			reqs = entry.requires,
			internals = [];
	
		if (reqs.length) {
			reqs.forEach(function (req) {
				var dep, deps;
				if ((dep = map[req.name])) {
					internals.push(dep.name);
					deps = graph[dep.name] || (graph[dep.name] = []);
					deps.push(entry);
				} else externals[req.name] = null;
			});
			if (!internals.length) nodes.push(entry);
			else entry.internals = internals;
		} else nodes.push(entry);

	});

	while (nodes.length) {
		var
			node = nodes.shift(),
			deps = graph[node.name];
		ordered.push(node.name);
		if (deps && deps.length) {
			deps.forEach(function (dep) {
				var idx = dep.internals.indexOf(node.name);
				if (idx === -1) this.emit('error', new Error('could not find reference of ' +
					'dependent module "' + node.name + '" from "' + dep.name + '"'));
				dep.internals.splice(idx, 1);
				if (!dep.internals.length) {
					delete dep.internals;
					nodes.push(dep);
				}
			});
		}
		delete graph[node.name];
	}

	if ((cycles = Object.keys(graph)).length) {
		this.emit('error', new Error('unmet or circular dependencies: ' + cycles.join(',')));
	}
	
	externals = Object.keys(externals);

	log.debug('%s final ordered modules', bundle.name, ordered);
	if (externals.length) log.debug('%s final external dependencies', bundle.name, externals);

	bundle.order = ordered;
	bundle.externals = externals;
}