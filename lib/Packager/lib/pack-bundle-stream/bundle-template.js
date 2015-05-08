// each bundle has its own unique scope, preserving a local reference to any previously set
// global require method
(function (previous) {
	
	var
		// this is the bundle's own manifest the content of which will come during the build
		// and it will inject the values
		manifest = {},
		// this is the cache of previously requested modules so they can be immediately
		// returned later
		found = {},
		// this is an array of modules that need to be executed as soon as loaded
		entries = [];
	
	// this is our internal method for retrieving modules
	function require (name) {
		var
			id = typeof name == 'string' ? manifest[name] : name,
			cached = found[id],
			entry, method, map, _r, _m;
		
		// if it was cached, return it and be done
		if (cached != null) return cached;
		
		// determine if this bundle even has the requested module
		entry = manifest[id];
		if (!entry) {
			// if there was another require method globalized before this bundle loaded, attempt
			// to use it
			if (previous) return previous(name);
			else throw 'cannot find the requested module ' + name;
		}
		
		method = entry[0];
		// we use the map because relative paths aren't guaranteed to be unique
		map = entry[1];
		_r = function (sub) {
			var s = map[sub];
			return require(s != null ? s : sub);
		};
		_m = {exports: {}};
		method(_m, _m.exports, window, _r);
		return (found[id] = _m.exports);
	}
	
	window.require = require;
	
	// if there are any modules noted as being entries we simply require them
	for (var i = 0; i < entries.length; ++i) require(entries[i]);
	
})(window.require);