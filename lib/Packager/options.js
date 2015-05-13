'use strict';

/**
* Available options used for the CLI packager but whose keys are the valid runtime options.
*/
module.exports = {
	
	package: {
		help: 'The relative path to the application directory to package',
		position: 0,
		default: '.'
	},
	
	logLevel: {
		full: 'log-level',
		abbr: 'l',
		default: 'info',
		help: 'What level of output to use [error, log, debug, info, verbose]'
	},
	
	devMode: {
		full: 'dev-mode',
		abbr: 'D',
		help: 'Whether or not this build is a development build; negated if --production set',
		flag: true,
		// temporary
		default: true
	},
	
	cache: {
		help: 'Enables the use of a cachefile, if it exists and also the ability to write to the ' +
			'cachefile. This cachefile can significantly improve build-times in some cases. To ' +
			'force a clean build but cache the results also use the --clean flag with --cache. ' +
			'To disable use --no-cache.',
		flag: true,
		default: true
	},
	
	cacheFile: {
		help: 'Set this to a specific filename for the cache file. If it is not the default, then ' +
			'this will need to be set to the correct file name in subsequent runs to be found',
		default: '.e_cache'
	},
	
	clean: {
		help: 'Only used in tandem with --cache. With force a complete rebuild of the target but ' +
			'will cache the result for subsequent runs. If --cache is enabled but no cache file ' +
			'exists, it is the same as using this option.',
		flag: true,
		default: false
	},
	
	targets: {
		help: 'A comma-separated list of bundles to build. If --cache is enabled and includes ' +
			'an entry for a listed target, it will be rebuilt and the cache ignored. This can be ' +
			'used to limit build time by only rebuilding the source that is changing.',
		transform: function (targets) {
			return targets.split(',');
		}
	},
	
	sourceMaps: {
		full: 'source-maps',
		help: 'Whether or not to build source-maps when in --dev-mode; disable with --no-source-maps',
		flag: true,
		default: true
	},
	
	production: {
		full: 'production',
		abbr: 'P',
		help: 'Build in production mode; supersedes the --dev-mode and --no-dev-mode flag',
		flag: true,
		default: false
	},
	
	paths: {
		full: 'paths',
		help: 'Relative paths (comma separated) indicating where the packager should ' +
			'search for required libraries',
		transform: function (paths) {
			return paths.split(',');
		},
		default: ['lib']
	},
	
	externals: {
		help: 'To build without bundled external libraries, use --no-externals; always false ' +
			'when in --library mode. NOTE that the library is still required to compile even if ' +
			'the output will not include it',
		flag: true,
		default: true
	},
	
	listOnly: {
		full: 'list-only',
		flag: true,
		default: false,
		help: 'Set this flag to have it output the dependency tree to stdout'
	},
	
	skipExternals: {
		full: 'skip',
		help: 'A comma-separated list of external libraries that should not be included in the ' +
			'output when not in --library mode\n\n\t\tExample: --skip=enyo,moonstone\n',
		transform: function (skips) {
			return skips.split(',');
		}
	},
	
	isLibrary: {
		full: 'library',
		help: 'Produce a library build instead of a packaged application build from the designated ' +
			'package and entry file; will ignore the --template-index flag',
		flag: true,
		default: false
	},
	
	title: {
		help: 'To set the <title> of the output project index if not in --library mode'
	},
	
	outdir: {
		abbr: 'd',
		help: 'Where to place the output files',
		default: './dist'
	},
	
	outfile: {
		abbr: 'o',
		help: 'The output filename for the compiled application HTML when not in --library mode',
		default: 'index.html'
	},
	
	outAssetDir: {
		full: 'asset-outdir',
		abbr: 'a',
		help: 'The directory for all assets in the package output, relative to outdir',
		default: '.'
	},
	
	inlineCss: {
		full: 'inline-css',
		abbr: 'c',
		help: 'Only used in production mode, whether or not to produce an output CSS file or ' +
			'inline CSS into the index.html file; turn off with --no-inline-css',
		flag: true,
		default: true
	},
	
	outCssFile: {
		full: 'css-outfile',
		help: 'Only used in production mode, the name of the output CSS file if --no-inline-css',
		default: 'output.css'
	},
	
	outJsFile: {
		full: 'js-outfile',
		help: 'Only used in production mode, the name of the output JavaScript file if --no-inline-js',
		default: 'output.js'
	},
	
	inlineJs: {
		full: 'inline-js',
		abbr: 'j',
		help: 'Only used in production mode, whether or not to produce an output JS file or ' +
			'inline JavaScript into the index.html file; turn off with --no-inline-js',
		flag: true,
		default: true
	},
	
	templateIndex: {
		full: 'template-index',
		abbr: 't',
		help: 'Instead of using the auto-generated HTML index, start from this file'
	}
};