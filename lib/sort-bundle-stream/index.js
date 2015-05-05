'use strict';

var
	util = require('util');

var
	Transform = require('stream').Transform;

module.exports = SortBundleStream;

function SortBundleStream (opts) {
	if (!(this instanceof SortBundleStream)) return new SortBundleStream(opts);
	
	Transform.call(this, {objectMode: true});
}

util.inherits(SortBundleStream, Transform);

SortBundleStream.prototype._transform = function (bundle, nil, next) {
	
	var
		graph = {},
		map = bundle.modules,
		nodes = [],
		ordered = [],
		cycles;
	
	Object.keys(map).forEach(function (nom) {
	
		var
			entry = map[nom],
			reqs = entry.requires,
			internals = [];
		
		if (reqs.length) {
			reqs.forEach(function (req) {
				var dep, deps;
				if ((dep = map[req])) {
					internals.push(dep.name);
					deps = graph[dep.name] || (graph[dep.name] = []);
					deps.push(entry);
				}
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
	
	bundle.order = ordered;
	
	next(null, bundle);
};