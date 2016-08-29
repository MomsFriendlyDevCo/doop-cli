#!/usr/bin/env node

/**
* Doop unknown command catcher
* This is a weird hack to work around the fact that Commander doesn't handle command aliasing too well
* ANY command will fall though to here even if it WOULD succeed
*/

var _ = require('lodash');
var async = require('async-chainable');
var colors = require('chalk');
var doop = require('.');
var fspath = require('path');
var glob = require('glob');

var cmd = process.argv[2]; // Exclude node + filename

async()
	.then(doop.getUserSettings)
	// Get list of supported commands {{{
	.then('commands', function(next) {
		glob(fspath.join(__dirname, 'doop-*.js'), function(err, files) {
			if (err) return next(err);
			next(null, files.map(f => f.replace(/.*\/doop-(.*?)\.js$/, '$1')));
		});
	})
	// }}}
	// Handle the incoming command {{{
	.then(function(next) {
		if (!cmd && doop.settings.aliases.default) { // No command given (and we support a default command) - substitute `doop.settings.aliases.default`
			cmd = doop.settings.aliases.default;
			require('./doop-' + cmd);
		} else if (doop.settings.aliases[cmd]) { // Command is an alias - redirect to that
			cmd = doop.settings.aliases[cmd];
			require('./doop-' + cmd);
		} else if (_.includes(this.commands, cmd)) { // Existing command given - will be handled by commanders upstream require()
			return next('SKIP');
		}
	})
	// }}}
	// End {{{
	.end(function(err) {
		console.log(this.commands);
		if (err && err == 'SKIP') { // Die quietly - usually because some other process is handling the end condition
			console.log('DIE QUIET!');
		} else if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
	// }}}
