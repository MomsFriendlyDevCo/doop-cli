#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var colors = require('chalk');
var copy = require('ncp');
var doop = require('.');
var fspath = require('path');
var glob = require('glob');
var program = require('commander');

program
	.version(require('./package.json').version)
	.usage('[unit...]')
	.description('Install one or more units from the upstream Doop repo')
	.option('-s, --server', 'Specify explicitally that a unit refers to a server side unit (cannot be used with `--client`)')
	.option('-c, --client', 'Limit list to only client units (Specify explicitally that a unit refers to a client side unit (cannot be used with `--server`))')
	.option('-d, --dryrun', 'Dry run. Don\'t actually do anything')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.option('-r, --repo [repo]', 'Override the upstream Doop repo to use')
	.parse(process.argv);

async()
	// Sanity checks {{{
	.then(function(next) {
		if (!program.server && !program.client) return next('Must specifiy either --client or --server');
		if (program.server && program.client) return next('Only --client OR --server can be specified. Not both');
		if (!program.args.length) return next('At least one unit must be specified');
		next();
	})
	// }}}
	.then(doop.chProjectRoot)
	// Prepare the units we would install {{{
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
	// Check the units don't already exist before we do anything {{{
	.then(function(next) {
		if (this.units.some(unit => unit.existing)) return next('Units already installed: ' + this.units.filter(unit => unit.existing).map(unit => unit.id).join(', '));
		next();
	})
	// }}}
	// Get repo {{{
	.then('repo', function(next) {
		doop.getDoopPath(next, program.repo);
	})
	.then(function(next) {
		if (program.verbose) console.log('Using Doop source:', colors.cyan(this.repo));
		next();
	})
	// }}}
	// Install the units {{{
	.forEach('units', function(next, unit) {
		var source = fspath.join(this.repo, doop.settings.paths[program.client ? 'client' : 'server'], unit.id);
		var dest = fspath.join(doop.settings.paths[program.client ? 'client' : 'server'], unit.id);
		if (program.dryrun) {
			console.log('Would install', colors.cyan(unit.id), 'From', colors.cyan(source), '=>', colors.cyan(dest));
			return next();
		}

		console.log('Install', colors.cyan(unit.id));
		if (program.verbose) console.log(colors.cyan(source), '=>', colors.cyan(dest));
		copy(source, dest, {stopOnError: true, dereference: true}, next);
	})
	// }}}
	// End {{{
	.end(function(err) {
		if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			console.log(colors.cyan(this.units.length), (this.units.length == 1 ? 'unit' : 'units') + ' installed');
			process.exit(0);
		}
	});
	// }}}
