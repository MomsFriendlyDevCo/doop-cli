#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var colors = require('chalk');
var doop = require('.');
var fspath = require('path');
var glob = require('glob');
var program = require('commander');
var rimraf = require('rimraf');

program
	.version(require('./package.json').version)
	.usage('[unit...]')
	.description('Delete an exising unit from the project')
	.option('-s, --server', 'Specify explicitally that a unit refers to a server side unit (cannot be used with `--client`)')
	.option('-c, --client', 'Limit list to only client units (Specify explicitally that a unit refers to a client side unit (cannot be used with `--server`))')
	.option('-d, --dryrun', 'Dry run. Don\'t actually do anything')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.parse(process.argv);

async()
	// Sanity checks {{{
	.then(function(next) {
		if (!program.args.length) return next('At least one unit must be specified');
		next();
	})
	// }}}
	.then(doop.chProjectRoot)
	.then(doop.getUserSettings)
	// Prepare the units we would delete {{{
	.set('units', [])
	.forEach(program.args, function(next, arg) {
		var unit = {id: arg};
		this.units.push(unit);

		// Try to find the existing unit in async
		doop.getUnit(function(err, found) {
			if (err) return next(err);
			if (found) unit.existing = found;
			next();
		}, (program.server ? 'server' : program.client ? 'client' : null), program.args[0]);
	})
	// }}}
	// Check that the units actually exist {{{
	.then(function(next) {
		if (this.units.some(unit => !unit.existing)) return next('Units do not exist: ' + this.units.filter(unit => !unit.existing).map(unit => colors.cyan(unit.id)).join(', '));
		next();
	})
	// }}}
	// Remove the units {{{
	.forEach('units', function(next, unit) {
		var path = fspath.join(doop.settings.paths[program.client ? 'client' : 'server'], unit.id);
		if (program.dryrun) {
			console.log('Would delete', colors.cyan(unit.id), 'From', colors.cyan(path));
			return next();
		}

		rimraf(path, next);
	})
	// }}}
	// End {{{
	.end(function(err) {
		if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			if (!program.dryrun) console.log(colors.cyan(this.units.length), (this.units.length == 1 ? 'unit' : 'units') + ' deleted');
			process.exit(0);
		}
	});
	// }}}
