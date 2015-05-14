'use strict';

var
	util = require('util'),
	fs = require('fs-extra'),
	path = require('path');

var
	log = require('../../../logger');

var
	Writable = require('stream').Writable;

module.exports = WriteFilesStream;

function WriteFilesStream (opts) {
	if (!(this instanceof WriteFilesStream)) return new WriteFilesStream(opts);
	
	opts = opts || {};
	this.options = opts;
	
	Writable.call(this, {objectMode: true});
}

util.inherits(WriteFilesStream, Writable);

WriteFilesStream.prototype._write = function (file, nil, next) {
	var
		stream = this,
		opts = this.options,
		end = function (err) {
			if (err) stream.emit('error', new Error(
				'could not write final file "' + file.outfile + '": ' + err
			));
			
			next();
		},
		writeFile = function () {
			if (file.copy) {
				
				if (!file.cached) {
					log.debug('copying file %s to %s', file.source, file.outfile);
					fs.copy(file.source, file.outfile, end);
				} else {
					log.debug('file %s is cached, checking to see if we need to copy it', file.outfile);
					fs.stat(file.outfile, function (err, stat) {
						if (!stat) {
							log.debug('%s needs to be copied', file.outfile);
							fs.copy(file.source, file.outfile, end);
						} else {
							log.debug('%s does not need to be copied', file.outfile);
							end();
						}
					});
				}
			}
			else {
				if (!file.cached) {
					log.debug('writing file %s', file.outfile);
					fs.writeFile(file.outfile, file.contents, end);
				} else {
					log.debug('file %s is cached, checking to see if we need to write it', file.outfile);
					fs.stat(file.outfile, function (err, stat) {
						if (!stat) {
							log.debug('%s needs to be written', file.outfile);
							fs.writeFile(file.outfile, file.contents, end);
						} else {
							log.debug('%s does not need to be written', file.outfile);
							end();
						}
					});
				}
			}
		};
	
	if (!this._ensured) {
		fs.ensureDir(opts.outdir, function (err) {
			if (err) return stream.emit(err);
			log.info('writing final files');
			stream._ensured = true;
			writeFile();
		});
	} else writeFile();

};