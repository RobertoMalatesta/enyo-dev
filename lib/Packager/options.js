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
	
	production: {
		full: 'production',
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
		abbr: 'e',
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