#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var asyncFlush = require('async-chainable-flush');
var colors = require('chalk');
var doop = require('.');
var glob = require('glob');
var fs = require('fs');
var fspath = require('path');
var program = require('commander');
var sha1 = require('node-sha1');

program
	.version(require('./package.json').version)
	.description('List units installed for the current project')
	.option('-b, --basic', 'Display a simple list, do not attempt to hash file differences')
	.option('-s, --server', 'Limit list to only server units (cannot be used with `--client`)')
	.option('-c, --client', 'Limit list to only client units (cannot be used with `--server`)')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.parse(process.argv);

async()
	.use(asyncFlush)
	.then(doop.chProjectRoot)
	.then(doop.getUserSettings)
	// Get the list of units {{{
	.parallel({
		client: function(next) {
			if (program.server) return next();
			doop.getUnits(function(err, units) {
				if (err) return next(err);
				next(null, units.map(u => { return {id: u, path: fspath.join(doop.settings.paths.client, u), files:{}} }));
			}, 'client');
		},
		server: function(next) {
			if (program.server) return next();
			doop.getUnits(function(err, units) {
				if (err) return next(err);
				next(null, units.map(u => { return {id: u, path: fspath.join(doop.settings.paths.server, u), files:{}} }));
			}, 'server');
		},
	})
	// }}}
	// Hash file comparisons unless program.basic {{{
	// Get repo {{{
	.then('repo', function(next) {
		if (program.basic) return next();
		doop.getDoopPath(next, program.repo);
	})
	.then(function(next) {
		if (program.basic) return next();
		if (program.verbose) console.log('Using Doop source:', colors.cyan(this.repo));
		next();
	})
	// }}}
	// Scan project + Doop file list and hash all files (unless !program.basic) {{{
	.then(function(next) {
		if (program.basic) return next();

		// Make a list of all files in both this project and in the doop repo
		// For each file create an object with a `local` sha1 hash and `doop` sha1 hash

		var hashQueue = async(); // Hash tasks to perform

		async()
			.forEach(_.concat(this.client, this.server), function(next, unit) {
				async()
					.parallel([
						// Hash all project files {{{
						function(next) {
							glob(fspath.join(unit.path, '**'), {nodir: true}, function(err, files) {
								if (files.length) {
									unit.existsInProject = true;
									files.forEach(function(file) {
										hashQueue.defer(file, function(next) {
											if (program.verbose) console.log('Hash file (Proj)', colors.cyan(file));
											sha1(fs.createReadStream(file), function(err, hash) {
												if (!unit.files[file]) unit.files[file] = {path: file};
												unit.files[file].project = hash;
												next();
											});
										});
									});
								} else {
									unit.existsInProject = false;
								}
								next();
							});
						},
						// }}}
						// Hash all Doop files {{{
						function(next) {
							glob(fspath.join(doop.settings.paths.doop, unit.path, '**'), {nodir: true}, function(err, files) {
								if (files.length) {
									unit.existsInDoop = true;
									files.forEach(function(rawFile) {
										var croppedPath = rawFile.substr(doop.settings.paths.doop.length + 1);
										var file = fspath.join(doop.settings.paths.doop, croppedPath);

										hashQueue.defer(file, function(next) {
											if (program.verbose) console.log('Hash file (Doop)', colors.cyan(croppedPath));
											sha1(fs.createReadStream(file), function(err, hash) {
												if (!unit.files[croppedPath]) unit.files[croppedPath] = {path: file};
												unit.files[croppedPath].doop = hash;
												next();
											});
										});
									});
								} else {
									unit.existsInDoop = false;
								}
								next();
							});
						},
						// }}}
					])
					.end(next)
			})
			.end(function(err) {
				if (err) return next(err);

				// Wait for hashing queue to finish
				hashQueue.await().end(next);
			});
	})
	// }}}
	// }}}
	// Present the list {{{
	.then(function(next) {
		var task = this;
		if (program.verbose > 1) console.log();
		[
			!program.server ? 'client' : null,
			!program.client ? 'server' : null,
		]
			.filter(i => !!i) // Filter out empty
			.forEach(type => {
				console.log(colors.bold.blue(type));
				if (program.basic) { // Dont bother to do any weird hash comparison operations
					this[type].forEach(unit => console.log(' -', unit.id));
				} else {
					this[type].forEach(function(unit) {
						if (unit.existsInProject && !unit.existsInDoop) {
							console.log(colors.grey(' -', unit.id));
						} else if (!unit.existsInProject && unit.existsInDoop) {
							console.log(colors.red(' -', unit.id));
						} else { // In both Doop + Project - examine file differences
							var changes = [];
							// Edited:
							_.filter(unit.files, f => f.project && f.doop && f.project != f.doop)
								.forEach(f => changes.push(colors.yellow.bold('~') + f.path.substr(unit.path.length+1)));
							// Created:
							_.filter(unit.files, f => f.project && !f.doop)
								.forEach(f => changes.push(colors.green.bold('+') + f.path.substr(unit.path.length+1)));
							// Deleted
							_.filter(unit.files, f => f.doop && !f.project)
								.forEach(f => changes.push(colors.red.bold('-') + f.path.substr(doop.settings.paths.doop.length+unit.path.length+2)));


							if (changes.length) {
								console.log(' -', unit.id, colors.blue('('), changes.join(', '), colors.blue(')'));
							} else {
								console.log(' -', unit.id);
							}
						}
					});
				}
			});
		next();
	})
	// }}}
	// End {{{
	.flush()
	.end(function(err) {
		if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
	// }}}
