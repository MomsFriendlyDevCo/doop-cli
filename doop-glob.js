#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var asyncFlush = require('async-chainable-flush');
var childProcess = require('child_process');
var colors = require('chalk');
var doop = require('.');
var glob = require('glob-all');
var fs = require('fs');
var fspath = require('path');
var program = require('commander');

program
	.version(require('./package.json').version)
	.usage('[globs...]')
	.description('Glob for files within units and perform operations on them')
	.option('-e, --edit', 'Open all found files in EDITOR')
	.option('-p, --pretty', 'Pretty-print the found objects - showing which units each file belongs to')
	.option('-n, --dry-run', 'Dont actually open the editor, just print the command')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.parse(process.argv);

async()
	.use(asyncFlush)
	.then(doop.chProjectRoot)
	.then(doop.getUserSettings)
	// Sanity checks {{{
	.then(function(next) {
		if (!program.args.length || !program.args[0]) return next('Glob expression must be specified');
		next();
	})
	// }}}
	// Get the list of units {{{
	.then('units', function(next) {
		doop.getUnits(function(err, units) {
			if (err) return next(err);
			next(null, units.map(u => { return {
				id: u,
				path: fspath.join(doop.settings.paths.units, u),
				schmFiles: {},
			} }));
		});
	})
	// }}}
	// Find files matching the glob within units {{{
	.forEach('units', function(next, unit) {
		glob(program.args, {cwd: unit.path}, function(err, files) {
			if (err) return next(err);
			unit.schmFiles = files;
			next();
		});
	})
	// }}}
	// Present the list {{{
	.then(function(next) {
		if (program.edit) {
			if (!process.env.EDITOR) return next('No EDITOR environment variable present');

			var filePaths = _(this.units)
				.filter(u => u.schmFiles.length > 0)
				.map(u => u.schmFiles.map(f => fspath.join(u.path, f)))
				.flatten()
				.value();

			if (program.verbose || program.dryRun) console.log('Will run:', colors.cyan(process.env.EDITOR, filePaths.map(f => '"' + f + '"').join(' ')));

			if (!program.dryRun) {
				var editor = childProcess.spawn(process.env.EDITOR, filePaths, {stdio: 'inherit'});

				editor.on('error', next);
				editor.on('close', code => next(code != 0 ? 'Exited with code ' + code : null));
			} else {
				next();
			}

		} else if (program.pretty) { // Pretty print found files
			this.units
				.filter(u => u.schmFiles.length > 0)
				.forEach(function(unit) {
					console.log('-', colors.cyan(unit.id));
					unit.schmFiles
						.map(f => fspath.join(unit.path, f))
						.forEach(f => console.log('   ', f));
				});
			next();
		} else { // Just display a list
			var filePaths = _(this.units)
				.filter(u => u.schmFiles.length > 0)
				.map(u => u.schmFiles.map(f => fspath.join(u.path, f)))
				.flatten()
				.forEach(f => console.log(f));
			next();
		}
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
