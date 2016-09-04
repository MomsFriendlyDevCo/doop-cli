#!/usr/bin/env node

var _ = require('lodash');
var async = require('async-chainable');
var asyncExec = require('async-chainable-exec');
var asyncFlush = require('async-chainable-flush');
var colors = require('chalk');
var doop = require('.');
var fspath = require('path');
var glob = require('glob');
var mustache = require('mustache');
var program = require('commander');

program
	.version(require('./package.json').version)
	.usage('[unit]')
	.description('Attempt to merge a unit with the upstream Doop repo')
	.option('-s, --server', 'Specify explicitally that a unit refers to a server side unit (cannot be used with `--client`)')
	.option('-c, --client', 'Limit list to only client units (Specify explicitally that a unit refers to a client side unit (cannot be used with `--server`))')
	.option('-d, --dryrun', 'Dry run. Don\'t actually do anything')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.option('-r, --repo [repo]', 'Override the upstream Doop repo to use')
	.option('-t, --tool [alias]', 'Specify a tool to use to merge', 'meld')
	.parse(process.argv);

async()
	.use(asyncFlush)
	.then(doop.chProjectRoot)
	.then(doop.getUserSettings)
	.set('unit', program.args[0] || undefined) // Optional unit to merge (if omitted all are used)
	// Get repo {{{
	.then('repo', function(next) {
		doop.getDoopPath(next, program.repo);
	})
	.then(function(next) {
		if (program.verbose) console.log('Using Doop source:', colors.cyan(this.repo));
		next();
	})
	// }}}
	// Perform merge {{{
	.then(function(next) {
		if (!doop.settings.tools[program.tool]) return next('Tool not found: "' + program.tool + '"');
		var v = {
			project: {
				path: fspath.join(process.cwd(), this.unit || ''),
			},
			doop: {
				path: fspath.join(this.repo, this.unit || ''),
			},
		};

		var toolCmd = mustache.render(doop.settings.tools[program.tool], v);
		if (program.dryrun) {
			console.log('Would run', colors.cyan(toolCmd));
			return next();
		}

		async()
			.use(asyncExec)
			.execDefaults({stdio: 'inherit'})
			.exec(toolCmd)
			.end(next);
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
