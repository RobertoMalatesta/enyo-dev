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
			'when in --library mode',
		flag: true,
		default: true
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
	
	outCssFile: {
		full: 'css-outfile',
		abbr: 'c',
		help: 'If the compiled CSS should not be inserted into the packaged HTML file'
	},
	
	outJsFile: {
		full: 'js-outfile',
		abbr: 'j',
		help: 'If the compiled JS should not be inserted into the packaged HTML file'
	},
	
	templateIndex: {
		full: 'template-index',
		abbr: 't',
		help: 'Instead of using the auto-generated HTML index, start from this file'
	}
};