#!/usr/bin/env node

var async = require('async-chainable');
var colors = require('chalk');
var doop = require('.');
var program = require('commander');

program
	.version(require('./package.json').version)
	.description('List units installed for the current project')
	.option('-s, --server', 'Limit list to only server units (cannot be used with `--client`)')
	.option('-c, --client', 'Limit list to only client units (cannot be used with `--server`)')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.parse(process.argv);

async()
	.then(doop.chProjectRoot)
	.then(doop.getUserSettings)
	// Get the list of units {{{
	.parallel({
		client: function(next) {
			if (program.server) return next();
			doop.getUnits(next, 'client');
		},
		server: function(next) {
			if (program.server) return next();
			doop.getUnits(next, 'server');
		},
	})
	// }}}
	// Present the list {{{
	.then(function(next) {
		[
			!program.server ? 'client' : null,
			!program.client ? 'server' : null,
		]
			.filter(i => !!i) // Filter out empty
			.forEach(type => {
				console.log(colors.bold.blue(type));
				this[type].forEach(unit => console.log(' -', unit));
			});
		next();
	})
	// }}}
	// End {{{
	.end(function(err) {
		if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
	// }}}
