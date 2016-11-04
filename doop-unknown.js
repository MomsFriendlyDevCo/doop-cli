#!/usr/bin/env node

/**
* Doop unknown command catcher
* This is a weird hack to work around the fact that Commander doesn't handle command aliasing too well
* ANY command will fall though to here even if it WOULD succeed
*/

var _ = require('lodash');
var async = require('async-chainable');
var asyncFlush = require('async-chainable-flush');
var childProcess = require('child_process');
var colors = require('chalk');
var doop = require('.');
var fspath = require('path');
var glob = require('glob');
var spawnArgs = require('spawn-args');

var cmd = process.argv[2]; // Exclude node + filename

async()
	.use(asyncFlush)
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
		} else if (doop.settings.aliases[cmd]) { // Command is an alias - redirect to that
			cmd = doop.settings.aliases[cmd];
			cmd += ' ' + process.argv // Append any remaining ARGV stuff
				.slice(3)
				.join(' ');
			cmd = _.trim(cmd);
		} else if (_.includes(this.commands, cmd)) { // Existing command given - will be handled by commanders upstream require()
			return next('STOP');
		} else {
			return next('Unknown Command: ' + cmd);
		}

		// If we got here cmd should be populated
		if (!cmd.startsWith('!')) cmd = doop.settings.paths.doopCli + ' ' + cmd; // If command doesn't begin with '!' assume it should have a doop prefix ('!' prefixing copied shamelessly from Git)

		var cmdArgs = spawnArgs(cmd);
		var mainCmd = cmdArgs.shift();

		var editor = childProcess.spawn(mainCmd, cmdArgs, {stdio: 'inherit'});

		editor.on('error', next);
		editor.on('close', code => next(code != 0 ? 'Exited with code ' + code : 'STOP'));
	})
	// }}}
	// End {{{
	.flush()
	.end(function(err) {
		if (err && err == 'STOP') { // Die quietly - usually because some other process is handling the end condition
			process.exit(0);
		} else if (err) {
			console.log(colors.red('Doop Error'), err.toString());
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
	// }}}
